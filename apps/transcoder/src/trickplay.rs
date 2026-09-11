//! Seek-bar preview images.
//!
//! A viewer scrubbing a two hour film wants to see where they are landing. The
//! only way to answer that instantly is to have decoded the frames in advance,
//! so Valence renders one small image every few seconds into tiled sheets and
//! indexes them with `WebVTT`, which every player already understands.
//!
//! Sheets rather than one file per thumbnail: a film of two hours at one frame
//! every ten seconds is 720 images, and 720 requests to draw one hover is a
//! worse trade than four sheet downloads.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::process::Command;

use crate::capability::Capabilities;
use crate::integrity::decodes;
use crate::media::VideoRange;
use crate::render_registry::RenderRegistry;
use crate::steps_aside::steps_aside;
use crate::transcode_plan::HardwareAccel;

/// Written only when every sheet is on disk.
///
/// Same reasoning as a transcode session: a directory holding sheets is not
/// proof they are all there, because a killed ffmpeg leaves a partial tile
/// grid that looks finished.
const COMPLETE_MARKER: &str = ".complete";

/// The index a player reads.
pub const INDEX_NAME: &str = "thumbnails.vtt";

/// Which recipe drew a set of sheets.
///
/// Counted separately from the preview recipe, and deliberately: sheets take
/// minutes a film to redraw, so a change to how preview clips are encoded must
/// not throw them away. See `preview::RECIPE` for what this is for.
///
/// **Raise this whenever the way sheets are drawn changes** — the tile grid, the
/// sampling interval's meaning, the filter chain.
const RECIPE: u32 = 1;

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrickplayRequest {
    pub input_path: String,
    /// How many times the library holding this file has been reset.
    ///
    /// Part of the address, for the same reason as on a preview, and required
    /// for the same reason: a caller that omits it asks for generation zero and
    /// redraws a feature film's worth of sheets on every request rather than
    /// once.
    pub generation: u32,
    /// Seconds between thumbnails.
    pub interval_seconds: u32,
    /// Width of a single thumbnail in pixels. Height follows the source.
    pub tile_width: u32,
    /// Thumbnails across one sheet.
    pub columns: u32,
    /// Thumbnails down one sheet.
    pub rows: u32,
    /// The backend the operator chose, where they chose one.
    ///
    /// Absent means automatic. Sheets picked whichever hardware encoder was
    /// listed first and ignored the setting entirely, exactly as previews did.
    #[serde(default)]
    pub hardware_accel: Option<HardwareAccel>,
    /// Whether the caller is willing to wait for rendering to finish.
    ///
    /// A library import waits, because nobody is watching it. A player must
    /// not: a feature length film takes minutes to render and a viewer who
    /// pressed play should be watching it, not waiting on seek previews.
    #[serde(default = "waits_by_default")]
    pub wait: bool,
    /// Which of the server's jobs asked for this, where one did.
    ///
    /// Carried only so the queue can say which scan a piece of work belongs
    /// to. A player asking for its own thumbnails is nobody's, so this is
    /// absent rather than empty.
    #[serde(default)]
    pub owner: Option<String>,
}

/// What a caller that says nothing about waiting means.
const fn waits_by_default() -> bool {
    true
}

impl Default for TrickplayRequest {
    fn default() -> Self {
        Self {
            input_path: String::new(),
            generation: 0,
            interval_seconds: 10,
            tile_width: 320,
            columns: 10,
            rows: 10,
            hardware_accel: None,
            wait: true,
            owner: None,
        }
    }
}

/// Where the thumbnails ended up.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrickplayIndex {
    pub id: String,
    pub interval_seconds: u32,
    pub tile_width: u32,
    pub tile_height: u32,
    pub columns: u32,
    pub rows: u32,
    /// Sheet file names, in time order.
    pub sheets: Vec<String>,
    /// Path the player fetches the `WebVTT` index from.
    pub index: String,
    /// Whether the sheets behind this index exist yet.
    ///
    /// False means rendering is under way and the caller should ask again
    /// later rather than fetch sheets that are not there.
    pub is_ready: bool,
}

/// Why thumbnails could not be made.
#[derive(Debug, Error)]
pub enum TrickplayError {
    #[error("the request asks for no thumbnails")]
    EmptyRequest,
    #[error("could not create the thumbnail directory: {0}")]
    Directory(std::io::Error),
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg produced no thumbnails: {0}")]
    NoOutput(String),
    #[error("a thumbnail sheet ffmpeg produced does not decode: {0}")]
    Corrupt(String),
    #[error("could not write the thumbnail index: {0}")]
    Index(std::io::Error),
}

impl TrickplayRequest {
    /// A stable identifier for this exact request.
    ///
    /// Content addressed like a transcode session, so asking twice reuses the
    /// sheets rather than decoding the film again — and [`RECIPE`] is part of the
    /// address, so asking twice across a change to how sheets are drawn does not.
    #[must_use]
    pub fn id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(RECIPE.to_be_bytes());
        hasher.update(self.generation.to_be_bytes());
        hasher.update(self.input_path.as_bytes());
        hasher.update(self.interval_seconds.to_be_bytes());
        hasher.update(self.tile_width.to_be_bytes());
        hasher.update(self.columns.to_be_bytes());
        hasher.update(self.rows.to_be_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            let _ = write!(id, "{byte:02x}");
        }

        id
    }
}

/// Scales a thumbnail to the source's shape.
///
/// Rounded to an even number because JPEG chroma subsampling works in pairs of
/// pixels, and an odd height makes ffmpeg refuse the filter chain outright.
#[must_use]
pub fn tile_height_for(tile_width: u32, source_width: u32, source_height: u32) -> u32 {
    if source_width == 0 || source_height == 0 {
        return tile_width * 9 / 16;
    }

    let scaled = (u64::from(tile_width) * u64::from(source_height)) / u64::from(source_width);
    let even = u32::try_from(scaled).unwrap_or(tile_width * 9 / 16) & !1;

    even.max(2)
}

/// How many thumbnails a piece of media of this length needs.
#[must_use]
pub fn thumbnail_count(duration_seconds: f64, interval_seconds: u32) -> u32 {
    if interval_seconds == 0 || duration_seconds <= 0.0 {
        return 0;
    }

    let count = (duration_seconds / f64::from(interval_seconds)).ceil();

    if !count.is_finite() || count < 1.0 {
        return 0;
    }

    if count >= f64::from(u32::MAX) {
        return u32::MAX;
    }

    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "the value is bounded and positive by the checks above"
    )]
    {
        count as u32
    }
}

/// What the source file is, as far as rendering thumbnails cares.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SheetSource {
    pub width: u32,
    pub height: u32,
    pub duration_seconds: f64,
    /// What the source says it is, which decides what its frames come down as.
    pub bit_depth: Option<u8>,
    /// Whether it needs converting to something a browser draws.
    ///
    /// Sheets were never converted at all, on any path, so every HDR film in a
    /// library had washed-out thumbnails under its scrub bar while its preview
    /// clip beside them was converted properly.
    pub range: VideoRange,
}

/// What a render is drawn with, and what the machine proved it can do.
#[derive(Clone, Copy)]
pub struct Tools<'a> {
    pub ffmpeg: &'a str,
    pub device: &'a str,
    pub capabilities: &'a Capabilities,
}

/// What the first pass writes, one image per interval.
const THUMBNAIL_PATTERN: &str = "frame-%08d.jpg";

/// What the second pass writes, a grid of them.
const SHEET_PATTERN: &str = "sheet-%03d.jpg";

/// How hard the JPEG encoder tries, on whichever scale it reads.
const JPEG_QUALITY: u32 = 4;

/// How many threads a thumbnail render may use.
///
/// One. Two was a guess at how much of a machine to leave alone, and the
/// measurement says it was answering the wrong question: four sheet renders
/// together held about one core of twenty, because this work waits on a disk
/// rather than on a processor. Nvidia's decoder also has no threading of its
/// own and Jellyfin passes it one explicitly, so one is required there rather
/// than merely tidy.
///
/// What actually keeps a render out of a viewer's way is niceness, which costs
/// nothing when nobody is watching. See [`crate::steps_aside`].
const RENDER_THREADS: u32 = 1;

/// Which encoder draws the thumbnails, and therefore where the frames go.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SheetEncoder {
    /// The device draws them, so the frames never come down.
    Hardware(String),
    /// The processor draws them, so the frames come down first.
    Software,
}

/// Picks the encoder that draws a film's thumbnails.
///
/// JPEG is something four of these backends make — `mjpeg_vaapi`, `mjpeg_qsv`,
/// `mjpeg_videotoolbox`, `mjpeg_rkmpp` — which this build denied for a long
/// time, so every thumbnail in a library was drawn by the processor and every
/// frame had to leave the device to reach it.
///
/// The encoder has to sit on the same backend the frames are already on. A
/// machine with both Intel paths verified could otherwise be handed VAAPI
/// surfaces and a QSV encoder, which is not a chain, so anything that does not
/// match falls to the processor rather than being forced.
#[must_use]
pub fn sheet_encoder(capabilities: &Capabilities, accel: Option<HardwareAccel>) -> SheetEncoder {
    let Some(wanted) = accel.filter(|found| *found != HardwareAccel::None) else {
        return SheetEncoder::Software;
    };

    match capabilities.encoder_for("mjpeg", Some(wanted)) {
        Some(found) if found.accel == wanted => SheetEncoder::Hardware(found.encoder.clone()),
        _ => SheetEncoder::Software,
    }
}

/// How this encoder is told how hard to try.
///
/// The scales are not the same and neither are the flags. `VAAPI` and `QSV`
/// take a global quality, Rockchip an initial quantiser, and everything else
/// the JPEG quality scale — so a number written for one of them means something
/// else to another, and the flag it is written under is simply ignored.
fn quality_arguments(encoder: &str) -> [String; 2] {
    let flag = if encoder.ends_with("_vaapi") || encoder.ends_with("_qsv") {
        "-global_quality:v"
    } else if encoder.ends_with("_rkmpp") {
        "-qp_init:v"
    } else {
        "-qscale:v"
    };

    [flag.to_owned(), JPEG_QUALITY.to_string()]
}

/// The ffmpeg arguments that draw one thumbnail per interval.
///
/// The first of two passes, and the one that costs anything. It writes single
/// images rather than a grid, which is the whole reason the frames can stay on
/// the device: `tile` is a software filter, so asking for a grid here forced
/// every frame down to system memory and made a hardware JPEG encoder
/// unreachable. Jellyfin writes single images for the same reason and tiles
/// them afterwards.
///
/// `fps` comes first so the expensive filters only run on the frames that
/// survive it. Conversion comes before the scale, because converting an
/// already-resampled picture loses highlight detail, and before the mapping
/// onto the backend's own frames, because on `QSV` the converter is `VAAPI`'s
/// and the decoder is handing over `VAAPI` surfaces.
///
/// `-skip_frame nokey` is asked only of a decoder in software. Telling a
/// hardware decoder to throw away everything between keyframes is not a thing
/// every one of them will do, and `QSV` does not merely refuse it: it hangs the
/// device, which resets it and takes down whatever else was using it.
#[must_use]
pub fn extract_arguments(
    request: &TrickplayRequest,
    tile_height: u32,
    source: SheetSource,
    on_device: Option<(HardwareAccel, &str)>,
    encoder: &SheetEncoder,
    directory: &Path,
) -> Vec<String> {
    let onto_the_device = on_device
        .and_then(|(found, device)| found.pipeline().map(|pipeline| (found, pipeline, device)));
    let draws_on_the_device = matches!(encoder, SheetEncoder::Hardware(_));

    let mut filters = vec![format!("fps=1/{}", request.interval_seconds)];

    match onto_the_device {
        Some((_, pipeline, _)) => {
            if source.range != VideoRange::Sdr {
                if let Some(mapper) = pipeline.tone_map {
                    filters.push(mapper.to_owned());
                }
            }

            if let Some(mapping) = pipeline.maps_onto_device {
                filters.push(mapping.to_owned());
            }

            filters.push(format!(
                "{scaler}=w={width}:h={height}",
                scaler = pipeline.scaler,
                width = request.tile_width,
                height = tile_height,
            ));

            if !draws_on_the_device {
                filters.push(format!(
                    "hwdownload,format={}",
                    pipeline.download_format_for(source.bit_depth)
                ));
            }
        }
        None => filters.push(format!(
            "scale={width}:{height}",
            width = request.tile_width,
            height = tile_height,
        )),
    }

    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-threads".to_owned(),
        RENDER_THREADS.to_string(),
    ];

    if let Some((found, pipeline, device)) = onto_the_device {
        arguments.extend(found.filter_device_arguments(device));

        if found.ffmpeg_flag().is_some() {
            arguments.push("-hwaccel".to_owned());
            arguments.push(pipeline.decodes_with.to_owned());
            arguments.push("-hwaccel_output_format".to_owned());
            arguments.push(pipeline.decoded_format.to_owned());
            arguments.push("-noautorotate".to_owned());
        }
    } else {
        arguments.extend(["-skip_frame".to_owned(), "nokey".to_owned()]);
    }

    let drawn_by = match encoder {
        SheetEncoder::Hardware(name) => name.clone(),
        SheetEncoder::Software => "mjpeg".to_owned(),
    };

    arguments.extend([
        "-i".to_owned(),
        request.input_path.clone(),
        "-vf".to_owned(),
        filters.join(","),
        "-an".to_owned(),
        "-sn".to_owned(),
        "-c:v".to_owned(),
        drawn_by.clone(),
    ]);

    arguments.extend(quality_arguments(&drawn_by));

    arguments.extend([
        "-f".to_owned(),
        "image2".to_owned(),
        directory.join(THUMBNAIL_PATTERN).to_string_lossy().into(),
    ]);

    arguments
}

/// The ffmpeg arguments that gather the thumbnails into sheets.
///
/// The second pass, and a cheap one: it reads images a few hundred pixels wide
/// and writes them back in a grid. Nothing here touches the device, and nothing
/// needs to — the work that was worth accelerating happened in the first pass.
#[must_use]
pub fn tile_arguments(request: &TrickplayRequest, directory: &Path) -> Vec<String> {
    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-threads".to_owned(),
        RENDER_THREADS.to_string(),
        "-i".to_owned(),
        directory.join(THUMBNAIL_PATTERN).to_string_lossy().into(),
        "-vf".to_owned(),
        format!("tile={}x{}", request.columns, request.rows),
        "-qscale:v".to_owned(),
        JPEG_QUALITY.to_string(),
        directory.join(SHEET_PATTERN).to_string_lossy().into(),
    ]
}

/// Clears the single thumbnails away once they have been gathered into sheets.
///
/// A two hour film leaves seven hundred of them, and nothing reads them again.
async fn forget_thumbnails(directory: &Path) {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return;
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        if entry.file_name().to_string_lossy().starts_with("frame-") {
            let _ = tokio::fs::remove_file(entry.path()).await;
        }
    }
}

/// Builds the `WebVTT` index.
///
/// Each cue points at a rectangle inside a sheet through the `#xywh` fragment,
/// which is how players are told where a thumbnail sits without downloading
/// anything else to find out.
#[must_use]
pub fn build_index(request: &TrickplayRequest, tile_height: u32, count: u32) -> String {
    let per_sheet = request.columns * request.rows;
    let mut vtt = String::from("WEBVTT\n\n");

    if per_sheet == 0 {
        return vtt;
    }

    for index in 0..count {
        let start = index * request.interval_seconds;
        let end = start + request.interval_seconds;
        let sheet = index / per_sheet;
        let within = index % per_sheet;
        let x = (within % request.columns) * request.tile_width;
        let y = (within / request.columns) * tile_height;

        let _ = writeln!(
            vtt,
            "{} --> {}\nsheet-{:03}.jpg#xywh={},{},{},{}\n",
            format_timestamp(start),
            format_timestamp(end),
            sheet + 1,
            x,
            y,
            request.tile_width,
            tile_height,
        );
    }

    vtt
}

/// Formats seconds as the `hh:mm:ss.mmm` `WebVTT` insists on.
#[must_use]
pub fn format_timestamp(seconds: u32) -> String {
    format!(
        "{:02}:{:02}:{:02}.000",
        seconds / 3600,
        (seconds % 3600) / 60,
        seconds % 60
    )
}

/// Whether this set of thumbnails already exists.
async fn is_already_complete(directory: &Path) -> bool {
    tokio::fs::try_exists(directory.join(COMPLETE_MARKER))
        .await
        .unwrap_or(false)
}

/// Reads the sheet names on disk, in time order.
async fn list_sheets(directory: &Path) -> Vec<String> {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return Vec::new();
    };

    let mut names = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_sheet = Path::new(&name)
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jpg"));

        if is_sheet {
            names.push(name);
        }
    }

    names.sort();

    names
}

/// The first sheet that will not open, if any of them will not.
///
/// Every sheet is checked rather than a sample. A run cut short leaves its
/// damage in the last file it touched, which is exactly the one a check of the
/// first sheet would call fine.
async fn unreadable_sheet(ffmpeg: &str, directory: &Path, sheets: &[String]) -> Option<String> {
    for name in sheets {
        if let Err(reason) = decodes(ffmpeg, &directory.join(name)).await {
            return Some(format!("{name}: {reason}"));
        }
    }

    None
}

/// Serialises requests for the same thumbnails.
///
/// Rendering a feature length film takes minutes, and every caller that asks
/// while it is running would otherwise start its own ffmpeg decoding the same
/// file into the same directory. A player mounting twice, or two people
/// opening the same film, is enough to do it. The completion marker cannot
/// prevent this on its own: none of them find it, because none of them have
/// finished.
#[derive(Clone, Default)]
pub struct TrickplayRegistry {
    renders: RenderRegistry,
}

impl TrickplayRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Takes this set of thumbnails to render, unless something already has.
    pub async fn claim(&self, id: &str) -> bool {
        self.renders.claim(id).await
    }

    /// Remembers that a render failed, for whoever asks next.
    pub async fn remember_failure(&self, id: &str, reason: String) {
        self.renders.remember_failure(id, reason).await;
    }

    /// Takes what went wrong, where anything did, and forgets it.
    pub async fn take_failure(&self, id: &str) -> Option<String> {
        self.renders.take_failure(id).await
    }

    /// Lets go of a claim whose work never ran.
    pub async fn give_up(&self, id: &str) {
        self.renders.give_up(id).await;
    }

    /// Renders the sheets and the index, or reuses what is already there.
    ///
    /// Waits rather than duplicating the work when the same thumbnails are
    /// already being rendered.
    ///
    /// # Errors
    ///
    /// Returns [`TrickplayError`] when the directory cannot be made, ffmpeg
    /// cannot be started, it writes no sheets, or the index cannot be saved.
    pub async fn generate(
        &self,
        tools: Tools<'_>,
        cache_root: &Path,
        request: &TrickplayRequest,
        source: SheetSource,
        accel: Option<HardwareAccel>,
    ) -> Result<TrickplayIndex, TrickplayError> {
        let id = request.id();
        let gate = self.renders.gate(&id).await;
        let permit = gate.lock().await;

        let outcome = generate(tools, cache_root, request, source, accel).await;

        drop(permit);
        self.renders.release(&id).await;

        outcome
    }
}

/// Renders the sheets and the index, or reuses what is already there.
///
/// Prefer [`TrickplayRegistry::generate`], which will not start a second
/// ffmpeg over a file already being read.
///
/// Every sheet is opened before the set is marked complete, and a set that
/// fails is rendered again without the hardware. A sheet nobody can draw is
/// worth no more than no sheet at all, and it would otherwise be kept for as
/// long as the file stays in the library.
///
/// # Errors
///
/// Returns [`TrickplayError`] when the directory cannot be made, ffmpeg cannot
/// be started, it writes no sheets, the sheets it wrote will not open even in
/// software, or the index cannot be saved.
pub async fn generate(
    tools: Tools<'_>,
    cache_root: &Path,
    request: &TrickplayRequest,
    source: SheetSource,
    accel: Option<HardwareAccel>,
) -> Result<TrickplayIndex, TrickplayError> {
    let Tools {
        ffmpeg,
        device,
        capabilities,
    } = tools;
    let tile_height = tile_height_for(request.tile_width, source.width, source.height);
    let count = thumbnail_count(source.duration_seconds, request.interval_seconds);

    if count == 0 || request.columns == 0 || request.rows == 0 {
        return Err(TrickplayError::EmptyRequest);
    }

    let id = request.id();
    let directory = cache_root.join("trickplay").join(&id);

    let finish = |sheets: Vec<String>| TrickplayIndex {
        is_ready: true,
        interval_seconds: request.interval_seconds,
        tile_width: request.tile_width,
        tile_height,
        columns: request.columns,
        rows: request.rows,
        index: format!("/trickplay/{id}/{INDEX_NAME}"),
        id: id.clone(),
        sheets,
    };

    if is_already_complete(&directory).await {
        return Ok(finish(list_sheets(&directory).await));
    }

    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(TrickplayError::Directory)?;

    let drawn_by = sheet_encoder(capabilities, accel);
    let extracted = steps_aside(&mut Command::new(ffmpeg))
        .args(extract_arguments(
            request,
            tile_height,
            source,
            accel.map(|found| (found, device)),
            &drawn_by,
            &directory,
        ))
        .kill_on_drop(true)
        .output()
        .await
        .map_err(TrickplayError::Spawn)?;

    if !extracted.status.success() {
        return Err(TrickplayError::NoOutput(
            String::from_utf8_lossy(&extracted.stderr).trim().to_owned(),
        ));
    }

    let gathered = steps_aside(&mut Command::new(ffmpeg))
        .args(tile_arguments(request, &directory))
        .kill_on_drop(true)
        .output()
        .await
        .map_err(TrickplayError::Spawn)?;

    forget_thumbnails(&directory).await;

    let sheets = list_sheets(&directory).await;

    if sheets.is_empty() {
        return Err(TrickplayError::NoOutput(
            String::from_utf8_lossy(&gathered.stderr).trim().to_owned(),
        ));
    }

    if let Some(corrupt) = unreadable_sheet(ffmpeg, &directory, &sheets).await {
        return Err(TrickplayError::Corrupt(corrupt));
    }

    tokio::fs::write(
        directory.join(INDEX_NAME),
        build_index(request, tile_height, count),
    )
    .await
    .map_err(TrickplayError::Index)?;

    tokio::fs::write(directory.join(COMPLETE_MARKER), b"")
        .await
        .map_err(TrickplayError::Index)?;

    Ok(finish(sheets))
}

/// Whether a set of thumbnails has already been rendered.
pub async fn is_complete(cache_root: &Path, id: &str) -> bool {
    is_already_complete(&directory_for(cache_root, id)).await
}

/// Describes thumbnails that have been asked for but not rendered.
///
/// Answers a caller that will not wait: it names where the index will be and
/// says plainly that it is not there yet, so the caller can ask again rather
/// than fetch sheets that do not exist.
#[must_use]
pub fn pending_index(request: &TrickplayRequest, tile_height: u32) -> TrickplayIndex {
    let id = request.id();

    TrickplayIndex {
        interval_seconds: request.interval_seconds,
        tile_width: request.tile_width,
        tile_height,
        columns: request.columns,
        rows: request.rows,
        index: format!("/trickplay/{id}/{INDEX_NAME}"),
        id,
        sheets: Vec::new(),
        is_ready: false,
    }
}

/// Where a generated set of thumbnails lives.
#[must_use]
pub fn directory_for(cache_root: &Path, id: &str) -> PathBuf {
    cache_root.join("trickplay").join(id)
}

#[cfg(test)]
mod tests {
    use super::{
        build_index, extract_arguments, format_timestamp, sheet_encoder, thumbnail_count,
        tile_arguments, tile_height_for, Capabilities, HardwareAccel, SheetEncoder, SheetSource,
        TrickplayRegistry, TrickplayRequest, VideoRange,
    };
    use crate::capability::VerifiedEncoder;
    use std::path::Path;

    #[tokio::test]
    async fn takes_a_set_of_thumbnails_only_once() {
        let registry = TrickplayRegistry::new();

        assert!(registry.claim("one").await, "nothing else held it");
        assert!(
            !registry.claim("one").await,
            "a render sits in a queue before it begins, so asking again while it waits would \
otherwise start a second one"
        );
        assert!(
            registry.claim("another").await,
            "a different film is its own work"
        );
    }

    #[tokio::test]
    async fn lets_go_of_a_claim_whose_work_never_ran() {
        let registry = TrickplayRegistry::new();

        assert!(registry.claim("one").await);
        registry.give_up("one").await;

        assert!(
            registry.claim("one").await,
            "a claim that outlived its work would leave that film unable to be asked for again"
        );
    }

    fn source_of(range: VideoRange) -> SheetSource {
        SheetSource {
            width: 1920,
            height: 1080,
            duration_seconds: 600.0,
            bit_depth: Some(8),
            range,
        }
    }

    fn on_qsv() -> Vec<String> {
        extract_arguments(
            &request(),
            180,
            source_of(VideoRange::Sdr),
            Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
            &SheetEncoder::Hardware("mjpeg_qsv".to_owned()),
            Path::new("/cache"),
        )
    }

    fn in_software() -> Vec<String> {
        extract_arguments(
            &request(),
            180,
            source_of(VideoRange::Sdr),
            None,
            &SheetEncoder::Software,
            Path::new("/cache"),
        )
    }

    fn request() -> TrickplayRequest {
        TrickplayRequest {
            input_path: "/media/film.mkv".to_owned(),
            generation: 0,
            interval_seconds: 10,
            tile_width: 320,
            columns: 2,
            rows: 2,
            hardware_accel: None,
            wait: true,
            owner: None,
        }
    }

    /// QSV does not refuse the option, it hangs the GPU — which resets the
    /// device and takes down whatever else on the machine was using it.
    #[test]
    fn does_not_ask_a_decoder_on_the_device_to_skip_frames() {
        let arguments = on_qsv();

        assert!(
            !arguments.iter().any(|argument| argument == "-skip_frame"),
            "{arguments:?}"
        );
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-hwaccel", "vaapi"]));
    }

    #[test]
    fn tile_height_follows_the_source_shape() {
        assert_eq!(tile_height_for(320, 1920, 1080), 180);
    }

    #[test]
    fn tile_height_is_always_even() {
        assert_eq!(tile_height_for(320, 1920, 1079) % 2, 0);
    }

    #[test]
    fn tile_height_falls_back_when_the_source_is_unknown() {
        assert_eq!(tile_height_for(320, 0, 0), 180);
    }

    #[test]
    fn a_two_hour_film_at_ten_seconds_needs_seven_hundred_and_twenty_thumbnails() {
        assert_eq!(thumbnail_count(7200.0, 10), 720);
    }

    #[test]
    fn a_partial_interval_still_gets_a_thumbnail() {
        assert_eq!(thumbnail_count(25.0, 10), 3);
    }

    #[test]
    fn nothing_is_generated_for_media_of_no_length() {
        assert_eq!(thumbnail_count(0.0, 10), 0);
    }

    #[test]
    fn an_interval_of_zero_is_refused_rather_than_dividing_by_it() {
        assert_eq!(thumbnail_count(100.0, 0), 0);
    }

    #[test]
    fn the_same_request_addresses_the_same_thumbnails() {
        assert_eq!(request().id(), request().id());
    }

    #[test]
    fn a_reset_library_addresses_its_sheets_somewhere_new() {
        let after_reset = TrickplayRequest {
            generation: 1,
            ..request()
        };

        assert_ne!(
            request().id(),
            after_reset.id(),
            "a reset that reused the address would reuse the sheets"
        );
    }

    #[test]
    fn the_same_generation_still_reuses_the_sheets() {
        let again = TrickplayRequest {
            generation: 2,
            ..request()
        };

        assert_eq!(
            again.id(),
            TrickplayRequest {
                generation: 2,
                ..request()
            }
            .id(),
            "redrawing a film's sheets on every hover is the fault this guards"
        );
    }

    #[test]
    fn the_recipe_is_part_of_the_address() {
        use sha2::{Digest as _, Sha256};
        use std::fmt::Write as _;

        let request = request();
        let mut hasher = Sha256::new();

        hasher.update(request.input_path.as_bytes());
        hasher.update(request.interval_seconds.to_be_bytes());
        hasher.update(request.tile_width.to_be_bytes());
        hasher.update(request.columns.to_be_bytes());
        hasher.update(request.rows.to_be_bytes());

        let mut without_the_recipe = String::with_capacity(32);

        for byte in hasher.finalize().iter().take(16) {
            let _ = write!(without_the_recipe, "{byte:02x}");
        }

        assert_ne!(
            request.id(),
            without_the_recipe,
            "sheets drawn by an older recipe must not answer to the same address"
        );
    }

    #[test]
    fn a_different_interval_addresses_different_thumbnails() {
        let coarse = TrickplayRequest {
            interval_seconds: 20,
            ..request()
        };

        assert_ne!(request().id(), coarse.id());
    }

    /// Decoded on the device, and brought down for the filters that draw the
    /// sheet. Left to ffmpeg the graph will not configure at all on QSV.
    #[test]
    fn decodes_on_the_device_and_brings_the_frames_down() {
        let arguments = on_qsv();

        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-hwaccel", "vaapi"]));
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-hwaccel_output_format", "vaapi"]));
        assert_eq!(
            chain, "fps=1/10,hwmap=derive_device=qsv,format=qsv,vpp_qsv=w=320:h=180",
            "nothing comes down: the device draws the thumbnails too"
        );
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "mjpeg_qsv"]));
    }

    #[test]
    fn draws_entirely_in_software_on_a_machine_with_no_device() {
        let arguments = in_software();

        assert!(!arguments.iter().any(|argument| argument == "-hwaccel"));
        assert!(!arguments
            .iter()
            .any(|argument| argument.contains("hwdownload")));
    }

    #[test]
    fn still_only_decodes_keyframes() {
        let arguments = in_software();

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-skip_frame", "nokey"]));
    }

    #[test]
    fn sampling_happens_before_scaling_so_only_kept_frames_are_resized() {
        let arguments = in_software();
        let filter = arguments
            .iter()
            .position(|argument| argument == "-vf")
            .and_then(|index| arguments.get(index + 1))
            .expect("the filter chain is passed");

        assert_eq!(filter, "fps=1/10,scale=320:180");
    }

    #[test]
    fn audio_and_subtitles_are_dropped_from_the_thumbnail_pass() {
        let arguments = in_software();

        assert!(arguments.iter().any(|argument| argument == "-an"));
        assert!(arguments.iter().any(|argument| argument == "-sn"));
    }

    /// Sheets were never converted at all, so every HDR film in a library had
    /// washed-out thumbnails under a scrub bar while its clip was converted
    /// properly a few pixels away.
    #[test]
    fn converts_an_hdr_film_before_drawing_its_thumbnails() {
        let arguments = extract_arguments(
            &request(),
            180,
            source_of(VideoRange::Hdr10),
            Some((HardwareAccel::Vaapi, "/dev/dri/renderD128")),
            &SheetEncoder::Hardware("mjpeg_vaapi".to_owned()),
            Path::new("/cache"),
        );
        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert_eq!(
            chain,
            "fps=1/10,tonemap_vaapi=format=nv12:p=bt709:t=bt709:m=bt709,scale_vaapi=w=320:h=180"
        );
    }

    /// The converter is VAAPI's and the decoder hands over VAAPI surfaces, so
    /// it has to run before the frames are mapped onto QSV.
    #[test]
    fn converts_before_mapping_the_frames_onto_qsv() {
        let arguments = extract_arguments(
            &request(),
            180,
            source_of(VideoRange::Hdr10),
            Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
            &SheetEncoder::Hardware("mjpeg_qsv".to_owned()),
            Path::new("/cache"),
        );
        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(chain.find("tonemap_vaapi") < chain.find("hwmap"), "{chain}");
    }

    /// NVIDIA has no JPEG encoder, so the frames have to come down for it.
    #[test]
    fn brings_the_frames_down_where_the_device_cannot_draw_jpeg() {
        let arguments = extract_arguments(
            &request(),
            180,
            source_of(VideoRange::Sdr),
            Some((HardwareAccel::Nvenc, "")),
            &SheetEncoder::Software,
            Path::new("/cache"),
        );
        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(chain.contains("hwdownload"), "{chain}");
        assert!(arguments.windows(2).any(|pair| pair == ["-c:v", "mjpeg"]));
    }

    #[test]
    fn writes_single_images_rather_than_a_grid_so_they_can_stay_on_the_device() {
        let arguments = on_qsv();
        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(!chain.contains("tile="), "{chain}");
        assert!(arguments.windows(2).any(|pair| pair == ["-f", "image2"]));
        assert!(arguments
            .iter()
            .any(|argument| argument.ends_with("frame-%08d.jpg")));
    }

    #[test]
    fn gathers_the_thumbnails_into_sheets_in_a_second_pass() {
        let arguments = tile_arguments(&request(), Path::new("/cache"));

        assert!(arguments
            .iter()
            .any(|argument| argument.ends_with("frame-%08d.jpg")));
        assert!(arguments.windows(2).any(|pair| pair == ["-vf", "tile=2x2"]));
        assert!(arguments
            .iter()
            .any(|argument| argument.ends_with("sheet-%03d.jpg")));
        assert!(!arguments.iter().any(|argument| argument == "-hwaccel"));
    }

    /// A number written for one scale means something else on another, and the
    /// flag it is written under is simply ignored.
    #[test]
    fn tells_each_encoder_how_hard_to_try_on_the_scale_it_reads() {
        let flag_of = |arguments: &[String]| {
            arguments
                .iter()
                .find(|argument| {
                    argument.starts_with("-global_quality")
                        || argument.starts_with("-qscale")
                        || argument.starts_with("-qp_init")
                })
                .cloned()
                .expect("a quality flag")
        };

        assert_eq!(flag_of(&on_qsv()), "-global_quality:v");
        assert_eq!(flag_of(&in_software()), "-qscale:v");
    }

    /// A machine with both Intel paths verified could otherwise be handed VAAPI
    /// surfaces and a QSV encoder, which is not a chain.
    #[test]
    fn only_draws_on_the_device_the_frames_are_already_on() {
        let intel = Capabilities {
            encoders: vec![
                VerifiedEncoder {
                    codec: "mjpeg".to_owned(),
                    encoder: "mjpeg_vaapi".to_owned(),
                    accel: HardwareAccel::Vaapi,
                    verified: true,
                },
                VerifiedEncoder {
                    codec: "mjpeg".to_owned(),
                    encoder: "mjpeg_qsv".to_owned(),
                    accel: HardwareAccel::Qsv,
                    verified: true,
                },
            ],
            ..Capabilities::default()
        };

        assert_eq!(
            sheet_encoder(&intel, Some(HardwareAccel::Vaapi)),
            SheetEncoder::Hardware("mjpeg_vaapi".to_owned())
        );
        assert_eq!(
            sheet_encoder(&intel, Some(HardwareAccel::Qsv)),
            SheetEncoder::Hardware("mjpeg_qsv".to_owned())
        );
        assert_eq!(
            sheet_encoder(&intel, Some(HardwareAccel::Nvenc)),
            SheetEncoder::Software,
            "nvidia has no jpeg encoder, and vaapi's is not on its frames"
        );
        assert_eq!(sheet_encoder(&intel, None), SheetEncoder::Software);
    }

    /// Measured, not guessed: four sheet renders together held one core of
    /// twenty, and nvidia's decoder has no threading of its own.
    #[test]
    fn asks_for_one_thread_because_the_work_waits_on_a_disk() {
        assert!(on_qsv().windows(2).any(|pair| pair == ["-threads", "1"]));
        assert!(in_software()
            .windows(2)
            .any(|pair| pair == ["-threads", "1"]));
    }

    #[test]
    fn leaves_a_rotated_source_for_the_player_to_turn() {
        assert!(on_qsv().iter().any(|argument| argument == "-noautorotate"));
    }

    #[test]
    fn timestamps_are_written_the_way_webvtt_demands() {
        assert_eq!(format_timestamp(3725), "01:02:05.000");
    }

    #[test]
    fn every_thumbnail_gets_a_cue() {
        let vtt = build_index(&request(), 180, 4);

        assert_eq!(vtt.matches("#xywh=").count(), 4);
    }

    #[test]
    fn cues_walk_across_a_sheet_before_moving_down_it() {
        let vtt = build_index(&request(), 180, 4);

        assert!(vtt.contains("sheet-001.jpg#xywh=0,0,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=320,0,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=0,180,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=320,180,320,180"));
    }

    #[test]
    fn a_full_sheet_rolls_over_to_the_next_one() {
        let vtt = build_index(&request(), 180, 5);

        assert!(vtt.contains("sheet-002.jpg#xywh=0,0,320,180"));
    }

    #[test]
    fn cue_times_follow_the_sampling_interval() {
        let vtt = build_index(&request(), 180, 2);

        assert!(vtt.contains("00:00:00.000 --> 00:00:10.000"));
        assert!(vtt.contains("00:00:10.000 --> 00:00:20.000"));
    }

    #[test]
    fn the_index_declares_itself_as_webvtt() {
        assert!(build_index(&request(), 180, 1).starts_with("WEBVTT\n"));
    }
}
