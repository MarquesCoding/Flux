use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::cache_sweep;
use crate::capability::{detect_capabilities, Capabilities};
use crate::fingerprint::{fingerprint, FingerprintRequest};
use crate::frame::{take_frame, FrameRequest};
use crate::monitor::{Monitor, Report};
use crate::preview::{
    directory_for as preview_directory, generate as generate_preview, is_complete as preview_ready,
    PreviewClip, PreviewRequest,
};
use crate::probe::probe_media;
use crate::queue::WorkQueue;
use crate::session::{await_manifest, SessionRegistry};
use crate::subtitle::{extract_subtitle, SubtitleRequest};
use crate::transcode_plan::{SessionSpec, MANIFEST_NAME};
use crate::trickplay::{
    directory_for, is_complete, pending_index, tile_height_for, SheetSource, TrickplayRegistry,
    TrickplayRequest,
};

const MANIFEST_TIMEOUT: Duration = Duration::from_secs(20);

/// How often a watching page is sent a new reading.
///
/// A second is fast enough to watch a transcode start and slow enough that
/// measuring costs less than the thing being measured.
const MONITOR_INTERVAL: Duration = Duration::from_secs(1);

/// What to call a file in a list of work.
///
/// The name alone: an operator watching a queue recognises "Parasite.mkv" and
/// learns nothing from the eighty characters of path in front of it.
fn name_of(path: &Path) -> String {
    path.file_name().map_or_else(
        || path.to_string_lossy().into_owned(),
        |name| name.to_string_lossy().into_owned(),
    )
}

/// Everything the routes need.
#[derive(Clone)]
pub struct AppState {
    pub registry: SessionRegistry,
    pub ffprobe: String,
    /// Directories the media service will read from.
    ///
    /// The service has no authentication of its own, so without this any
    /// caller that can reach the socket could read any file the process can.
    pub media_roots: Vec<PathBuf>,
    /// Keeps one set of thumbnails from being rendered twice at once.
    pub trickplay: TrickplayRegistry,
    /// Where background work waits its turn.
    ///
    /// Everything that reads a whole file goes through here, so there is a
    /// ceiling on how much of the machine work nobody is waiting for can take.
    pub queue: WorkQueue,
    /// What the machine is using, and what has happened lately.
    pub monitor: Monitor,
}

impl AppState {
    /// Whether a path lies inside a configured media root.
    #[must_use]
    pub fn is_readable(&self, path: &Path) -> bool {
        if self.media_roots.is_empty() {
            return true;
        }

        self.media_roots.iter().any(|root| path.starts_with(root))
    }
}

#[derive(Debug, Deserialize)]
pub struct ProbeRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileQuery {
    pub path: String,
}

/// One byte range, as parsed from a `Range` header.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

/// Parses a single-range `Range` header.
///
/// Only one range is supported, which is all a video element ever asks for.
/// Multi-range requests are answered with the whole file rather than a
/// malformed multipart response.
#[must_use]
pub fn parse_range(header: &str, length: u64) -> Option<ByteRange> {
    if length == 0 {
        return None;
    }

    let spec = header.strip_prefix("bytes=")?;

    if spec.contains(',') {
        return None;
    }

    let (from, to) = spec.split_once('-')?;

    let range = match (from.trim(), to.trim()) {
        ("", "") => return None,
        ("", last) => {
            let count: u64 = last.parse().ok()?;
            let count = count.min(length);

            ByteRange {
                start: length - count,
                end: length - 1,
            }
        }
        (first, "") => ByteRange {
            start: first.parse().ok()?,
            end: length - 1,
        },
        (first, last) => ByteRange {
            start: first.parse().ok()?,
            end: last.parse::<u64>().ok()?.min(length - 1),
        },
    };

    if range.start > range.end || range.start >= length {
        return None;
    }

    Some(range)
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub manifest: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

fn error(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(ErrorResponse {
            error: message.to_owned(),
        }),
    )
        .into_response()
}

/// Rejects any segment name that is not a plain file name.
///
/// Segment names arrive in the URL, so without this a request for
/// `../../etc/passwd` would be served from the session directory. Rejecting
/// anything containing a separator or a parent component is simpler to reason
/// about than trying to canonicalise afterwards.
fn is_safe_segment_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 128 {
        return false;
    }

    Path::new(name).components().count() == 1
        && Path::new(name)
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn content_type_for(name: &str) -> &'static str {
    let extension = Path::new(name)
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "m3u8" => "application/vnd.apple.mpegurl",
        "m4s" | "mp4" => "video/mp4",
        "jpg" | "jpeg" => "image/jpeg",
        "vtt" => "text/vtt",
        _ => "application/octet-stream",
    }
}

async fn serve_file(directory: &Path, name: &str, requested: Option<&str>) -> Response {
    if !is_safe_segment_name(name) {
        return error(StatusCode::BAD_REQUEST, "Invalid segment name.");
    }

    stream_file(
        &directory.join(name),
        content_type_for(name),
        requested,
        "No such segment.",
    )
    .await
}

/// The `Range` header, if the caller sent a readable one.
fn requested_range(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
}

/// How much is lifted off disk at a time.
///
/// Large enough that a 20 MB clip is a few hundred reads rather than thousands,
/// small enough that a hundred people watching at once is megabytes of buffers
/// and not gigabytes.
const STREAM_CHUNK: usize = 64 * 1024;

/// Sends a file from disk without holding it in memory, honouring byte ranges.
///
/// Reading a whole file to answer for part of it is the wrong shape twice over.
/// A preview is 18 MB and every request for one put all of it on the heap before
/// a byte reached the viewer, which is why the first hover felt slow. An original
/// file is measured in gigabytes, and a video element seeking through one asks
/// for a few hundred kilobytes at a time — so answering a scrub by reading the
/// whole film was the difference between a buffer and an outage.
///
/// Reads only the bytes asked for, a chunk at a time, and starts sending as soon
/// as the first chunk lands.
async fn stream_file(
    path: &Path,
    content_type: &str,
    requested: Option<&str>,
    missing: &str,
) -> Response {
    use tokio::io::{AsyncReadExt as _, AsyncSeekExt as _};

    let Ok(metadata) = tokio::fs::metadata(path).await else {
        return error(StatusCode::NOT_FOUND, missing);
    };

    let length = metadata.len();

    let range = requested.and_then(|value| parse_range(value, length));

    let (status, start, count) = match range {
        Some(ref found) => (
            StatusCode::PARTIAL_CONTENT,
            found.start,
            found.end.saturating_sub(found.start).saturating_add(1),
        ),
        None => (StatusCode::OK, 0, length),
    };

    let Ok(mut file) = tokio::fs::File::open(path).await else {
        return error(StatusCode::NOT_FOUND, missing);
    };

    if start > 0 && file.seek(std::io::SeekFrom::Start(start)).await.is_err() {
        return error(StatusCode::NOT_FOUND, missing);
    }

    let body = Body::from_stream(async_stream::stream! {
        let mut remaining = count;
        let mut buffer = vec![0_u8; STREAM_CHUNK];

        while remaining > 0 {
            let want = usize::try_from(remaining)
                .unwrap_or(STREAM_CHUNK)
                .min(STREAM_CHUNK);

            match file.read(&mut buffer[..want]).await {
                Ok(0) => break,
                Ok(read) => {
                    remaining = remaining
                        .saturating_sub(u64::try_from(read).unwrap_or(remaining));

                    yield Ok::<_, std::io::Error>(
                        axum::body::Bytes::copy_from_slice(&buffer[..read]),
                    );
                }
                Err(problem) => {
                    yield Err(problem);
                    break;
                }
            }
        }
    });

    let mut response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, count);

    if let Some(found) = range {
        response = response.header(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{length}", found.start, found.end),
        );
    }

    response.body(body).unwrap_or_else(|_| {
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not send the file.",
        )
    })
}

#[allow(clippy::unused_async, reason = "axum handlers must be async")]
/// Serves an original file, honouring byte ranges.
///
/// Direct play is the cheapest delivery there is: no transcode, no remux, no
/// segment cache, just the file. A video element seeks with `Range` requests,
/// so a server that ignores them forces the browser to download from the start
/// every time the viewer scrubs.
async fn direct_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FileQuery>,
) -> Response {
    let path = PathBuf::from(&query.path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    stream_file(
        &path,
        content_type_for(&query.path),
        headers
            .get(header::RANGE)
            .and_then(|value| value.to_str().ok()),
        "No such file.",
    )
    .await
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn capabilities(State(state): State<AppState>) -> Json<Capabilities> {
    let config = state.registry.config();

    Json(detect_capabilities(&config.ffmpeg, &config.device).await)
}

async fn probe(State(state): State<AppState>, Json(request): Json<ProbeRequest>) -> Response {
    match probe_media(&state.ffprobe, Path::new(&request.path)).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// A request to start a session, and who is asking.
///
/// The device is carried beside the spec rather than inside it because it must
/// not change the session's address: two devices asking for the same transcode
/// should share one directory and one encode. What the device decides is not
/// which transcode is made, but which one is worth keeping afterwards.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSessionRequest {
    #[serde(flatten)]
    spec: SessionSpec,
    #[serde(default)]
    device_id: Option<String>,
}

async fn start_session(
    State(state): State<AppState>,
    Json(request): Json<StartSessionRequest>,
) -> Response {
    let StartSessionRequest { spec, device_id } = request;

    eprintln!("session: {} {}", spec.summary(), spec.input_path);

    if !tokio::fs::try_exists(&spec.input_path)
        .await
        .unwrap_or(false)
    {
        eprintln!("session refused: no such input file: {}", spec.input_path);

        return error(StatusCode::NOT_FOUND, "No such input file.");
    }

    let id = match state.registry.start(spec, device_id.as_deref()).await {
        Ok(id) => id,
        Err(failure) => {
            eprintln!("session refused: {failure}");

            return error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string());
        }
    };

    let Some(directory) = state.registry.touch(&id).await else {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The session disappeared.",
        );
    };

    if !await_manifest(&directory.join(MANIFEST_NAME), MANIFEST_TIMEOUT).await {
        eprintln!(
            "session {id} produced no manifest within {}s; see the ffmpeg output above",
            MANIFEST_TIMEOUT.as_secs()
        );

        state.registry.stop(&id).await;

        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ffmpeg produced no manifest.",
        );
    }

    (
        StatusCode::OK,
        Json(SessionResponse {
            manifest: format!("/sessions/{id}/{MANIFEST_NAME}"),
            id,
        }),
    )
        .into_response()
}

async fn session_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let Some(directory) = state.registry.touch(&id).await else {
        return error(StatusCode::NOT_FOUND, "No such session.");
    };

    serve_file(&directory, &name, requested_range(&headers)).await
}

/// Makes the short clip a library page plays.
///
/// Encoded once and served as a file afterwards, so a wall of cards playing
/// previews costs nothing running: the alternative is half a dozen transcodes
/// competing with whatever somebody is actually watching.
async fn start_preview(
    State(state): State<AppState>,
    Json(request): Json<PreviewRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    let config = state.registry.config().clone();
    let id = request.id();

    if preview_ready(&config.cache_root, &id).await {
        return (
            StatusCode::OK,
            Json(PreviewClip {
                url: format!("/previews/{id}/{}", crate::preview::PREVIEW_NAME),
                id,
                is_ready: true,
            }),
        )
            .into_response();
    }

    let probe = match probe_media(&state.ffprobe, &path).await {
        Ok(probe) => probe,
        Err(failure) => return error(StatusCode::BAD_REQUEST, &failure.to_string()),
    };

    let Some(video) = probe.video.as_ref() else {
        return error(StatusCode::BAD_REQUEST, "That file has no video stream.");
    };

    let range = video.range;
    let capabilities = detect_capabilities(&config.ffmpeg, &config.device).await;
    let duration = probe.duration_seconds;

    if !request.wait {
        let queue = state.queue.clone();
        let subject = name_of(&path);
        let queued = request.clone();
        let ffmpeg = config.ffmpeg.clone();
        let cache_root = config.cache_root.clone();
        let found = capabilities.clone();

        tokio::spawn(async move {
            let _ = queue
                .run(
                    "preview",
                    &subject,
                    generate_preview(&ffmpeg, &cache_root, &queued, range, &found, duration),
                )
                .await;
        });

        return (
            StatusCode::ACCEPTED,
            Json(PreviewClip {
                url: format!("/previews/{id}/{}", crate::preview::PREVIEW_NAME),
                id,
                is_ready: false,
            }),
        )
            .into_response();
    }

    match state
        .queue
        .run(
            "preview",
            &name_of(&path),
            generate_preview(
                &config.ffmpeg,
                &config.cache_root,
                &request,
                range,
                &capabilities,
                duration,
            ),
        )
        .await
    {
        Ok(clip) => (StatusCode::OK, Json(clip)).into_response(),
        Err(failure) => error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string()),
    }
}

/// What is still wanted, as the requests that would ask for it.
///
/// Requests rather than addresses, deliberately. The address is a hash of the
/// request and belongs to the request type; a caller that computed it instead
/// would be a second implementation of the naming scheme, and the first time the
/// two disagreed the sweep would delete every artefact still in use.
#[derive(Debug, Deserialize)]
struct SweepRequest<T> {
    keep: Vec<T>,
}

/// Removes preview clips nothing addresses any more.
async fn sweep_previews(
    State(state): State<AppState>,
    Json(request): Json<SweepRequest<PreviewRequest>>,
) -> Response {
    let keep: HashSet<String> = request.keep.iter().map(PreviewRequest::id).collect();
    let root = state.registry.config().cache_root.join("previews");

    let report = cache_sweep::sweep(&root, &keep, cache_sweep::GRACE).await;

    (StatusCode::OK, Json(report)).into_response()
}

/// Counts what the artefact cache holds, now.
///
/// The figure on the dashboard is taken on a timer, because walking every
/// artefact directory is far too expensive to do when a page loads. This is
/// the exception an operator can ask for: somebody who has just run a sweep
/// wants to see the number move rather than wait five minutes to believe it.
async fn measure_cache(State(state): State<AppState>) -> Response {
    let root = state.registry.config().cache_root.clone();
    let reading = state.monitor.count_cache(&root).await;

    (StatusCode::OK, Json(reading)).into_response()
}

/// Removes thumbnail sheets nothing addresses any more.
async fn sweep_trickplay(
    State(state): State<AppState>,
    Json(request): Json<SweepRequest<TrickplayRequest>>,
) -> Response {
    let keep: HashSet<String> = request.keep.iter().map(TrickplayRequest::id).collect();
    let root = state.registry.config().cache_root.join("trickplay");

    let report = cache_sweep::sweep(&root, &keep, cache_sweep::GRACE).await;

    (StatusCode::OK, Json(report)).into_response()
}

/// What a forget answers.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ForgetReport {
    /// Whether there was anything there to remove.
    forgotten: bool,
}

/// Removes one clip, so the next request for it makes it again.
///
/// Takes the request rather than an address for the same reason the sweep does:
/// the address is a hash of the request and belongs here, so there is no id for
/// a caller to get wrong and nothing to escape a directory with.
async fn forget_preview(
    State(state): State<AppState>,
    Json(request): Json<PreviewRequest>,
) -> Response {
    let root = state.registry.config().cache_root.join("previews");
    let forgotten = cache_sweep::forget(&root, &request.id()).await;

    (StatusCode::OK, Json(ForgetReport { forgotten })).into_response()
}

/// Removes one set of sheets, so the next request draws them again.
async fn forget_trickplay(
    State(state): State<AppState>,
    Json(request): Json<TrickplayRequest>,
) -> Response {
    let root = state.registry.config().cache_root.join("trickplay");
    let forgotten = cache_sweep::forget(&root, &request.id()).await;

    (StatusCode::OK, Json(ForgetReport { forgotten })).into_response()
}

/// Serves a made clip.
async fn preview_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let directory = preview_directory(&state.registry.config().cache_root, &id);

    serve_file(&directory, &name, requested_range(&headers)).await
}

/// Takes a single frame out of a file.
///
/// Answers with the JPEG itself rather than a path, because the caller is
/// about to put it on a page and a second round trip would defeat the point of
/// having it early.
async fn start_frame(State(state): State<AppState>, Json(request): Json<FrameRequest>) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match take_frame(
        &state.registry.config().ffmpeg,
        &path,
        request.at_seconds,
        request.width,
    )
    .await
    {
        Ok(picture) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            picture,
        )
            .into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// Reads one subtitle track out of a container.
///
/// Answers with the whole track rather than a path, because a subtitle file is
/// a few tens of kilobytes and the player wants all of it before the first cue
/// is due.
async fn start_subtitle(
    State(state): State<AppState>,
    Json(request): Json<SubtitleRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match extract_subtitle(&state.registry.config().ffmpeg, &path, request.stream_index).await {
        Ok(track) => (StatusCode::OK, Json(track)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// Renders seek-bar previews for a file.
///
/// Answers with the index rather than the images: the player fetches sheets
/// only for the part of the timeline the viewer actually hovers over.
async fn start_trickplay(
    State(state): State<AppState>,
    Json(request): Json<TrickplayRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    let probe = match probe_media(&state.ffprobe, &path).await {
        Ok(probe) => probe,
        Err(failure) => return error(StatusCode::BAD_REQUEST, &failure.to_string()),
    };

    let Some(video) = probe.video.as_ref() else {
        return error(StatusCode::BAD_REQUEST, "That file has no video stream.");
    };

    let config = state.registry.config();
    let accel = detect_capabilities(&config.ffmpeg, &config.device)
        .await
        .best_encoder("h264")
        .and_then(|found| found.accel.ffmpeg_flag());

    if !request.wait {
        let id = request.id();

        if !is_complete(&config.cache_root, &id).await {
            let tile_height = tile_height_for(request.tile_width, video.width, video.height);
            let pending = pending_index(&request, tile_height);
            let trickplay = state.trickplay.clone();
            let ffmpeg = config.ffmpeg.clone();
            let cache_root = config.cache_root.clone();
            let queued = request.clone();
            let (width, height, duration) = (video.width, video.height, probe.duration_seconds);

            let queue = state.queue.clone();
            let subject = name_of(&path);

            tokio::spawn(async move {
                let _ = queue
                    .run(
                        "thumbnails",
                        &subject,
                        trickplay.generate(
                            &ffmpeg,
                            &cache_root,
                            &queued,
                            SheetSource {
                                width,
                                height,
                                duration_seconds: duration,
                            },
                            accel,
                        ),
                    )
                    .await;
            });

            return (StatusCode::ACCEPTED, Json(pending)).into_response();
        }
    }

    match state
        .queue
        .run(
            "thumbnails",
            &name_of(&path),
            state.trickplay.generate(
                &config.ffmpeg,
                &config.cache_root,
                &request,
                SheetSource {
                    width: video.width,
                    height: video.height,
                    duration_seconds: probe.duration_seconds,
                },
                accel,
            ),
        )
        .await
    {
        Ok(index) => (StatusCode::OK, Json(index)).into_response(),
        Err(failure) => error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string()),
    }
}

async fn trickplay_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> Response {
    serve_file(
        &directory_for(&state.registry.config().cache_root, &id),
        &name,
        requested_range(&headers),
    )
    .await
}

/// Fingerprints a window of a file's audio.
///
/// Answers with the hashes rather than a verdict: deciding what two episodes
/// share is arithmetic over those hashes, and arithmetic does not belong in
/// the service that owns `FFmpeg`.
async fn start_fingerprint(
    State(state): State<AppState>,
    Json(request): Json<FingerprintRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match state
        .queue
        .run(
            "fingerprint",
            &name_of(&PathBuf::from(&request.input_path)),
            fingerprint(&state.registry.config().ffmpeg, &request),
        )
        .await
    {
        Ok(prints) => (StatusCode::OK, Json(prints)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

async fn stop_session(State(state): State<AppState>, AxumPath(id): AxumPath<String>) -> Response {
    if state.registry.stop(&id).await {
        return (StatusCode::NO_CONTENT, Body::empty()).into_response();
    }

    error(StatusCode::NOT_FOUND, "No such session.")
}

/// What a player reports about itself, on a fixed interval, so a paused tab
/// left open is not mistaken for one that was closed.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatRequest {
    is_playing: bool,
}

async fn heartbeat_session(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(request): Json<HeartbeatRequest>,
) -> Response {
    if state.registry.heartbeat(&id, request.is_playing).await {
        return (StatusCode::NO_CONTENT, Body::empty()).into_response();
    }

    error(StatusCode::NOT_FOUND, "No such session.")
}

/// Everything an operator watching the server reads.
///
/// One request rather than four, because these are read together and read
/// often: a page refreshing four endpoints a second is four times the work for
/// no more information.
async fn monitor(State(state): State<AppState>) -> Response {
    let report = Report {
        resources: state.monitor.measure().await,
        queue: state.queue.snapshot().await,
        sessions: state.registry.len().await,
        logs: state.monitor.journal().read().await,
        cache: state.monitor.cache().await,
    };

    (StatusCode::OK, Json(report)).into_response()
}

/// The same report, over and over, as an event stream.
///
/// Server-sent events rather than a socket: this is one direction only, it
/// reconnects on its own, and it survives a proxy that knows nothing about it.
async fn monitor_stream(State(state): State<AppState>) -> Response {
    let stream = async_stream::stream! {
        let mut ticker = tokio::time::interval(MONITOR_INTERVAL);

        loop {
            ticker.tick().await;

            let report = Report {
                resources: state.monitor.measure().await,
                queue: state.queue.snapshot().await,
                sessions: state.registry.len().await,
                logs: state.monitor.journal().read().await,
                cache: state.monitor.cache().await,
            };

            if let Ok(payload) = serde_json::to_string(&report) {
                yield Ok::<_, std::convert::Infallible>(
                    axum::response::sse::Event::default().data(payload),
                );
            }
        }
    };

    axum::response::Sse::new(stream)
        .keep_alive(axum::response::sse::KeepAlive::default())
        .into_response()
}

/// Builds the media service routes.
///
/// Returned as a router rather than a bound server so the whole surface can be
/// exercised in tests without a socket.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/monitor", get(monitor))
        .route("/monitor/stream", get(monitor_stream))
        .route("/cache/measure", post(measure_cache))
        .route("/capabilities", get(capabilities))
        .route("/probe", post(probe))
        .route("/file", get(direct_file))
        .route("/sessions", post(start_session))
        .route("/sessions/{id}/{name}", get(session_file))
        .route("/sessions/{id}", axum::routing::delete(stop_session))
        .route(
            "/sessions/{id}/heartbeat",
            axum::routing::post(heartbeat_session),
        )
        .route("/fingerprint", post(start_fingerprint))
        .route("/frame", post(start_frame))
        .route("/previews", post(start_preview))
        .route("/previews/sweep", post(sweep_previews))
        .route("/previews/forget", post(forget_preview))
        .route("/previews/{id}/{name}", get(preview_file))
        .route("/subtitles", post(start_subtitle))
        .route("/trickplay", post(start_trickplay))
        .route("/trickplay/sweep", post(sweep_trickplay))
        .route("/trickplay/forget", post(forget_trickplay))
        .route("/trickplay/{id}/{name}", get(trickplay_file))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::{content_type_for, is_safe_segment_name, parse_range};

    #[test]
    fn reads_a_range_from_the_start() {
        assert_eq!(
            parse_range("bytes=0-99", 1000),
            Some(super::ByteRange { start: 0, end: 99 })
        );
    }

    #[test]
    fn reads_an_open_ended_range() {
        assert_eq!(
            parse_range("bytes=500-", 1000),
            Some(super::ByteRange {
                start: 500,
                end: 999
            })
        );
    }

    #[test]
    fn reads_a_suffix_range() {
        assert_eq!(
            parse_range("bytes=-100", 1000),
            Some(super::ByteRange {
                start: 900,
                end: 999
            })
        );
    }

    #[test]
    fn clamps_a_range_that_runs_past_the_end() {
        assert_eq!(
            parse_range("bytes=900-5000", 1000),
            Some(super::ByteRange {
                start: 900,
                end: 999
            })
        );
    }

    #[test]
    fn rejects_a_range_starting_past_the_end() {
        assert_eq!(parse_range("bytes=2000-", 1000), None);
    }

    #[test]
    fn rejects_a_backwards_range() {
        assert_eq!(parse_range("bytes=500-100", 1000), None);
    }

    #[test]
    fn ignores_multi_range_requests_rather_than_answering_them_badly() {
        assert_eq!(parse_range("bytes=0-99,200-299", 1000), None);
    }

    #[test]
    fn rejects_nonsense() {
        assert_eq!(parse_range("pages=1-2", 1000), None);
        assert_eq!(parse_range("bytes=", 1000), None);
        assert_eq!(parse_range("bytes=-", 1000), None);
    }

    #[test]
    fn accepts_ordinary_segment_names() {
        assert!(is_safe_segment_name("segment00001.m4s"));
        assert!(is_safe_segment_name("index.m3u8"));
        assert!(is_safe_segment_name("init.mp4"));
    }

    #[test]
    fn rejects_parent_traversal() {
        assert!(!is_safe_segment_name("../secrets"));
        assert!(!is_safe_segment_name("../../etc/passwd"));
    }

    #[test]
    fn rejects_nested_paths() {
        assert!(!is_safe_segment_name("nested/segment.m4s"));
    }

    #[test]
    fn rejects_absolute_paths() {
        assert!(!is_safe_segment_name("/etc/passwd"));
    }

    #[test]
    fn rejects_empty_and_overlong_names() {
        assert!(!is_safe_segment_name(""));
        assert!(!is_safe_segment_name(&"a".repeat(200)));
    }

    #[test]
    fn serves_playlists_and_segments_with_useful_types() {
        assert_eq!(
            content_type_for("index.m3u8"),
            "application/vnd.apple.mpegurl"
        );
        assert_eq!(content_type_for("segment1.m4s"), "video/mp4");
        assert_eq!(content_type_for("init.mp4"), "video/mp4");
        assert_eq!(content_type_for("notes.txt"), "application/octet-stream");
    }
}
