//! Replays a collected packet index through the rules that decide copyability.
//!
//! The copy path is the difference between serving a film by moving its bytes
//! and serving it by encoding it again, and the share of the library that can
//! take it was unmeasured. The census could not answer it: container headers
//! say nothing about where the keyframes are, or whether the pictures between
//! them are shown in the order they arrive.
//!
//! This is the counterpart of `replayCensus.ts`. The survey collects rows and
//! decides nothing; every verdict here comes from `parse_cuts`, `cut_interval`
//! and `can_copy_segments` — the same functions a session and a scan call — so
//! what it reports is what Flux would do rather than a second implementation
//! that agrees with it by luck.
//!
//! # The two verdicts
//!
//! Computed separately because the code has two, and they are not the same
//! rule:
//!
//! - **scan**, from `probe` in `router.rs`, is `can_copy_segments` alone, which
//!   measures the longest segment whether or not any cut is unsafe.
//! - **session**, from `boundaries_for` in `boundaries.rs`, answers yes as soon
//!   as no cut is unsafe, without measuring anything.
//!
//! A source whose cuts are all safe but whose keyframes are further apart than
//! `can_copy_segments` allows is therefore uncopyable to one and copyable to
//! the other. Whether the library holds such a file is what the disagreement
//! count reports.
//!
//! # Usage
//!
//! ```sh
//! cargo run -p flux-transcoder --example replay_keyframes -- <surveyDir>
//! ```
//!
//! where `surveyDir` holds `manifest.jsonl` and a `rows/` directory, as written
//! by `keyframeSurvey.mjs`.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    reason = "an offline analysis tool run by hand, where a panic is the report"
)]

use std::collections::BTreeMap;
use std::path::Path;

use flux_transcoder::boundaries::can_copy_segments;
use flux_transcoder::keyframes::{
    cut_interval, longest_segment, parse_cuts, safe_segment_lengths, segment_lengths,
};

/// The segment length copyability is judged against, matching
/// `PROBE_SEGMENT_SECONDS` in `router.rs`.
const REQUESTED_SEGMENT_SECONDS: f64 = 4.0;

/// What one file contributed.
struct Verdict {
    cuts: usize,
    unsafe_cuts: usize,
    longest: f64,
    scan_can_copy: bool,
    session_can_copy: bool,
}

/// What the whole survey came to.
#[derive(Default)]
struct Totals {
    total: usize,
    failed: usize,
    no_cuts: usize,
    open_gop: usize,
    scan_yes: usize,
    session_yes: usize,
    disagreements: Vec<(String, f64, usize)>,
    longest_buckets: BTreeMap<&'static str, usize>,
}

fn verdict_for(csv: &str, duration_seconds: f64) -> Verdict {
    let keyframes = parse_cuts(csv, duration_seconds);
    let cut_seconds = cut_interval(&keyframes, REQUESTED_SEGMENT_SECONDS);
    let unsafe_cuts = keyframes.cuts.iter().filter(|cut| !cut.is_safe()).count();

    let lengths = if unsafe_cuts == 0 {
        segment_lengths(&keyframes, cut_seconds)
    } else {
        safe_segment_lengths(&keyframes, cut_seconds)
    };
    let scan_can_copy = can_copy_segments(&keyframes, cut_seconds);

    Verdict {
        cuts: keyframes.cuts.len(),
        unsafe_cuts,
        longest: longest_segment(&lengths),
        scan_can_copy,
        session_can_copy: unsafe_cuts == 0 || scan_can_copy,
    }
}

/// Which bucket a source's longest segment falls in.
fn bucket_of(longest: f64) -> &'static str {
    match longest {
        l if l <= 4.0 => "<= 4s",
        l if l <= 8.0 => "4-8s",
        l if l <= 16.0 => "8-16s",
        l if l <= 60.0 => "16-60s",
        _ => "> 60s",
    }
}

fn field<'a>(record: &'a serde_json::Value, name: &str) -> Option<&'a str> {
    record.get(name).and_then(serde_json::Value::as_str)
}

/// The latest presentation time in a set of collected rows.
///
/// Rows arrive in decode order, so the last line is not the latest time.
fn last_packet_time(csv: &str) -> Option<f64> {
    csv.lines()
        .filter_map(|line| line.split(',').next()?.trim().parse::<f64>().ok())
        .filter(|time| time.is_finite() && *time >= 0.0)
        .fold(None, |latest: Option<f64>, time| {
            Some(latest.map_or(time, |value: f64| value.max(time)))
        })
}

/// The end of what was actually read, rather than the end of the film.
///
/// A windowed survey holds the first N seconds of packets while the manifest
/// carries the whole film's duration. Handed both, `segment_lengths` closes the
/// last segment at the end of the film rather than the end of the window and
/// invents one thousands of seconds long — which reads as every file in the
/// library being uncopyable, and was the first result this produced.
fn effective_duration(record: &serde_json::Value, csv: &str, duration: f64) -> f64 {
    if record.get("window").is_some_and(|window| !window.is_null()) {
        last_packet_time(csv).unwrap_or(duration)
    } else {
        duration
    }
}

/// Keeps only the rows a shorter window would have collected.
///
/// Lets the window be shortened after the fact, so how much of a film has to be
/// read before the verdict stops changing is answered from rows already
/// gathered rather than by reading every file again.
fn truncated(csv: &str, seconds: f64) -> String {
    csv.lines()
        .filter(|line| {
            line.split(',')
                .next()
                .and_then(|time| time.trim().parse::<f64>().ok())
                .is_none_or(|time| time <= seconds)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn add(totals: &mut Totals, record: &serde_json::Value, directory: &Path, truncate: Option<f64>) {
    totals.total += 1;

    if record.get("ok").and_then(serde_json::Value::as_bool) != Some(true) {
        totals.failed += 1;
        return;
    }

    let rows_file = field(record, "rowsFile").unwrap_or_default();
    let duration = record
        .get("durationSeconds")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);

    let Ok(csv) = std::fs::read_to_string(directory.join("rows").join(rows_file)) else {
        totals.failed += 1;
        return;
    };

    let csv = match truncate {
        Some(seconds) => truncated(&csv, seconds),
        None => csv,
    };

    let verdict = verdict_for(&csv, effective_duration(record, &csv, duration));

    if verdict.cuts == 0 {
        totals.no_cuts += 1;
        return;
    }

    if verdict.unsafe_cuts > 0 {
        totals.open_gop += 1;
    }
    if verdict.scan_can_copy {
        totals.scan_yes += 1;
    }
    if verdict.session_can_copy {
        totals.session_yes += 1;
    }
    if verdict.scan_can_copy != verdict.session_can_copy {
        totals.disagreements.push((
            field(record, "path").unwrap_or_default().to_owned(),
            verdict.longest,
            verdict.cuts,
        ));
    }

    *totals
        .longest_buckets
        .entry(bucket_of(verdict.longest))
        .or_default() += 1;
}

fn report(totals: &Totals) {
    let judged = totals.total - totals.failed - totals.no_cuts;

    #[allow(
        clippy::cast_precision_loss,
        reason = "counts far below the precision of f64"
    )]
    let percent = |n: usize| {
        if judged == 0 {
            0.0
        } else {
            (n as f64) * 100.0 / (judged as f64)
        }
    };

    println!("files in manifest:      {}", totals.total);
    println!("could not be read:      {}", totals.failed);
    println!("no keyframes found:     {}", totals.no_cuts);
    println!("judged:                 {judged}");
    println!();
    println!(
        "open GOP (a cut a decoder cannot start at): {} ({:.1}%)",
        totals.open_gop,
        percent(totals.open_gop)
    );
    println!(
        "copyable, as the scan judges it:            {} ({:.1}%)",
        totals.scan_yes,
        percent(totals.scan_yes)
    );
    println!(
        "copyable, as a session judges it:           {} ({:.1}%)",
        totals.session_yes,
        percent(totals.session_yes)
    );
    println!();
    println!("longest segment the source would yield:");
    for (bucket, count) in &totals.longest_buckets {
        println!("  {bucket:>8}  {count:>5}  ({:.1}%)", percent(*count));
    }
    println!();
    println!(
        "files the two rules disagree about: {}",
        totals.disagreements.len()
    );
    for (path, longest, cuts) in totals.disagreements.iter().take(20) {
        println!("  longest {longest:>7.1}s  cuts {cuts:>5}  {path}");
    }
}

fn main() {
    let directory = std::env::args()
        .nth(1)
        .expect("a survey directory to replay");
    let directory = Path::new(&directory);

    let manifest = std::fs::read_to_string(directory.join("manifest.jsonl"))
        .expect("reads the survey manifest");

    let truncate = std::env::args()
        .nth(2)
        .and_then(|arg| arg.parse::<f64>().ok());
    let mut totals = Totals::default();

    for line in manifest.lines().filter(|line| !line.trim().is_empty()) {
        let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };

        add(&mut totals, &record, directory, truncate);
    }

    if let Some(seconds) = truncate {
        println!("rows truncated to the first {seconds}s of each file");
        println!();
    }

    report(&totals);
}
