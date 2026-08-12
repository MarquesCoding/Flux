//! What the graphics hardware is doing.
//!
//! The figure worth having is encoder pressure: how loaded the dedicated
//! encode block is, because that is what decides whether another stream will
//! keep up. A card can be saturated at encoding while reading five percent
//! overall, so overall utilisation does not answer the question.
//!
//! Only NVIDIA reports the encode block separately. Where it cannot be had,
//! this reports what the whole card is doing instead and says which of the two
//! it measured, so nothing downstream can pass one off as the other. On Apple
//! silicon that distinction is not academic: hardware encoding runs on a media
//! engine that is not the GPU, and four saturated encodes leave overall
//! utilisation where it was.
//!
//! Intel is deliberately unread. `intel_gpu_top` is the only route to its
//! engine counters, it is not installed by default, and it needs privileges
//! Flux should not be asking for. An honest silence beats a number that is
//! wrong on most machines.

use std::time::Duration;

use serde::Serialize;
use tokio::process::Command;

/// How long a vendor tool is given before it is treated as absent.
///
/// Generous, because this runs on its own timer where nothing is waiting for
/// it, and short enough that a wedged tool cannot pile up behind itself.
const PROBE_TIMEOUT: Duration = Duration::from_secs(3);

/// What the graphics hardware is doing, and which part of it was measured.
///
/// Both figures are optional and mean different things by their absence: no
/// encoder reading means this vendor does not report the encode block, not
/// that the block is idle.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsUse {
    pub name: String,
    /// How loaded the dedicated encode block is, where the vendor reports it.
    pub encoder_percent: Option<f32>,
    /// What the card as a whole is doing, which is a different question.
    pub device_percent: Option<f32>,
}

/// Runs a vendor tool, treating anything short of a clean answer as absence.
///
/// A missing tool, a tool that fails and a tool that hangs are all the same
/// thing here: this machine cannot answer, and Flux says so rather than
/// guessing.
async fn run(program: &str, args: &[&str]) -> Option<String> {
    let call = Command::new(program).args(args).output();
    let outcome = tokio::time::timeout(PROBE_TIMEOUT, call).await.ok()?.ok()?;

    outcome
        .status
        .success()
        .then(|| String::from_utf8_lossy(&outcome.stdout).into_owned())
}

/// The digits straight after a key, as a percentage.
fn number_after(text: &str, key: &str) -> Option<f32> {
    let rest = text.split_once(key)?.1;
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();

    digits.parse().ok()
}

/// The quoted string straight after a key.
///
/// The angle brackets are stepped over because the registry prints the same
/// property as plain text on one machine and as data on another, and which of
/// those you get is not something worth depending on.
fn quoted_after(text: &str, key: &str) -> Option<String> {
    let rest = text.split_once(key)?.1.trim_start();
    let inner = rest.trim_start_matches('<').strip_prefix('"')?;

    Some(inner[..inner.find('"')?].to_owned())
}

/// What `nvidia-smi` said, which is the only vendor answer that names the
/// encode block on its own.
///
/// A card that does not support the encoder counter prints `[N/A]`, which
/// fails to parse and is reported as no reading — which is what it is.
fn parse_nvidia(output: &str) -> Option<GraphicsUse> {
    let mut fields = output.lines().next()?.split(',').map(str::trim);
    let name = fields.next()?;
    let device = fields.next()?;
    let encoder = fields.next()?;

    (!name.is_empty()).then(|| GraphicsUse {
        name: name.to_owned(),
        encoder_percent: encoder.parse().ok(),
        device_percent: device.parse().ok(),
    })
}

/// What the IO registry said about the accelerator on an Apple machine.
///
/// Overall utilisation only. The encoder is a separate media engine that
/// publishes its capabilities and no load counter, so there is nothing here to
/// report about it at any privilege short of root, and root does not have it
/// either.
///
/// Read a node at a time rather than as one dump, because a machine can have
/// more than one accelerator and taking the figure from one while taking the
/// name from another would describe a card that does not exist.
///
/// Nothing here is particular to a generation. Every Apple accelerator
/// registers under `IOAccelerator` whatever its class is called that year, and
/// the two figures are read by name. `Device Utilization %` is the whole-card
/// figure where a machine publishes it; `Renderer Utilization %` is the same
/// question asked of the shader cores, and stands in where it does not.
fn parse_apple(output: &str) -> Option<GraphicsUse> {
    output.split("+-o ").find_map(|node| {
        let device = number_after(node, "\"Device Utilization %\"=")
            .or_else(|| number_after(node, "\"Renderer Utilization %\"="))?;

        Some(GraphicsUse {
            name: quoted_after(node, "\"model\" =").unwrap_or_else(|| "Apple graphics".to_owned()),
            encoder_percent: None,
            device_percent: Some(device),
        })
    })
}

async fn read_nvidia() -> Option<GraphicsUse> {
    parse_nvidia(
        &run(
            "nvidia-smi",
            &[
                "--query-gpu=name,utilization.gpu,utilization.encoder",
                "--format=csv,noheader,nounits",
            ],
        )
        .await?,
    )
}

async fn read_apple() -> Option<GraphicsUse> {
    parse_apple(&run("ioreg", &["-r", "-d", "1", "-c", "IOAccelerator"]).await?)
}

/// What the kernel driver said about an AMD card.
///
/// Read from sysfs rather than a tool, so this needs nothing installed and no
/// privileges. Overall utilisation only: the driver does not break out the
/// encode block.
async fn read_amd() -> Option<GraphicsUse> {
    let mut cards = tokio::fs::read_dir("/sys/class/drm").await.ok()?;

    while let Ok(Some(card)) = cards.next_entry().await {
        let device = card.path().join("device");

        let Ok(busy) = tokio::fs::read_to_string(device.join("gpu_busy_percent")).await else {
            continue;
        };

        let Ok(percent) = busy.trim().parse::<f32>() else {
            continue;
        };

        return Some(GraphicsUse {
            name: tokio::fs::read_to_string(device.join("product_name"))
                .await
                .map(|name| name.trim().to_owned())
                .ok()
                .filter(|name| !name.is_empty())
                .unwrap_or_else(|| "AMD graphics".to_owned()),
            encoder_percent: None,
            device_percent: Some(percent),
        });
    }

    None
}

/// What the graphics hardware is doing, from whichever vendor answers.
///
/// Tried in the order of how much they can tell us, so a machine with an
/// NVIDIA card beside an integrated one reports the one that can speak about
/// its encoder.
pub async fn read() -> Option<GraphicsUse> {
    if let Some(reading) = read_nvidia().await {
        return Some(reading);
    }

    if let Some(reading) = read_amd().await {
        return Some(reading);
    }

    read_apple().await
}

#[cfg(test)]
mod tests {
    use super::{parse_apple, parse_nvidia};

    const IOREG: &str = r#"+-o AGXAcceleratorG17X  <class AGXAcceleratorG17X, id 0x100000775>
    {
      "PerformanceStatistics" = {"Alloc system memory"=5796593664,"Tiler Utilization %"=21,"Renderer Utilization %"=33,"Device Utilization %"=41,"In use system memory"=1284358144}
      "model" = "Apple M5 Pro"
      "IOClass" = "AGXAcceleratorG17X"
    }
"#;

    #[test]
    fn reads_what_the_whole_apple_card_is_doing() {
        let reading = parse_apple(IOREG).expect("the dump has a utilisation figure");

        assert_eq!(reading.device_percent, Some(41.0));
        assert_eq!(reading.name, "Apple M5 Pro");
    }

    #[test]
    fn never_claims_an_encoder_reading_apple_cannot_give() {
        let reading = parse_apple(IOREG).expect("the dump has a utilisation figure");

        assert_eq!(
            reading.encoder_percent, None,
            "an unreadable encoder must not read as an idle one"
        );
    }

    #[test]
    fn says_nothing_about_a_dump_with_no_figure_in_it() {
        assert!(parse_apple("+-o AGXAcceleratorG17X\n{\n}\n").is_none());
    }

    #[test]
    fn names_a_card_whose_model_it_could_not_read() {
        let reading = parse_apple("\"Device Utilization %\"=7").expect("there is a figure");

        assert_eq!(reading.name, "Apple graphics");
    }

    #[test]
    fn reads_a_model_the_registry_printed_as_data_rather_than_text() {
        let reading = parse_apple(
            "+-o AGXAcceleratorG13X\n\"model\" = <\"Apple M1 Max\">\n\"Device Utilization %\"=12",
        )
        .expect("there is a figure");

        assert_eq!(reading.name, "Apple M1 Max");
    }

    #[test]
    fn falls_back_to_the_renderer_figure_on_a_machine_that_omits_the_device_one() {
        let reading = parse_apple("+-o AGXAcceleratorG13G\n\"Renderer Utilization %\"=64")
            .expect("there is a figure");

        assert_eq!(reading.device_percent, Some(64.0));
    }

    #[test]
    fn keeps_a_name_and_a_figure_from_the_same_card() {
        let reading = parse_apple(
            "+-o IOAccelerator\n\"model\" = \"Idle card\"\n+-o AGXAcceleratorG17X\n\"model\" = \"Apple M5 Pro\"\n\"Device Utilization %\"=41",
        )
        .expect("the second node has a figure");

        assert_eq!(reading.name, "Apple M5 Pro");
        assert_eq!(reading.device_percent, Some(41.0));
    }

    #[test]
    fn reads_the_encode_block_where_nvidia_reports_it() {
        let reading = parse_nvidia("NVIDIA GeForce RTX 4070, 34, 88\n").expect("three fields");

        assert_eq!(reading.name, "NVIDIA GeForce RTX 4070");
        assert_eq!(reading.encoder_percent, Some(88.0));
        assert_eq!(reading.device_percent, Some(34.0));
    }

    #[test]
    fn keeps_the_card_when_it_will_not_speak_about_its_encoder() {
        let reading = parse_nvidia("NVIDIA T400, 12, [N/A]\n").expect("three fields");

        assert_eq!(reading.encoder_percent, None);
        assert_eq!(reading.device_percent, Some(12.0));
    }

    #[test]
    fn reports_only_the_first_card_rather_than_adding_them_up() {
        let reading = parse_nvidia("NVIDIA A, 10, 20\nNVIDIA B, 90, 90\n").expect("three fields");

        assert_eq!(reading.name, "NVIDIA A");
        assert_eq!(reading.encoder_percent, Some(20.0));
    }

    #[test]
    fn says_nothing_about_output_it_does_not_understand() {
        assert!(parse_nvidia("").is_none());
        assert!(parse_nvidia("Failed to initialise NVML\n").is_none());
    }
}
