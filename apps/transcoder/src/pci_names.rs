//! Naming a card from the number the kernel has for it.
//!
//! Only one vendor writes its own name into sysfs: `amdgpu` publishes
//! `product_name` and nothing else does. An Intel card is a pair of
//! identifiers and no words, so the words have to come from the same table
//! `lspci` reads — `pci.ids`, which the image installs and which names
//! `8086:4680` as `Alder Lake-S GT1 [UHD Graphics 770]`.
//!
//! The part in brackets is the name on the box, and it is the part an operator
//! recognises. Where the table gives one, that is what is reported; where it
//! does not, the whole entry is, because a codename is still better than
//! silence.
//!
//! A machine without the table gets the identifiers themselves rather than a
//! guess. They are ugly and they are diagnosable, which is the right trade for
//! a line whose job is to say which card was measured.

use tokio::fs;

/// The numbers a PCI device is known by.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CardId {
    pub vendor: u16,
    pub device: u16,
}

/// Where a distribution puts the table, in the order they are worth trying.
const TABLES: &[&str] = &["/usr/share/misc/pci.ids", "/usr/share/hwdata/pci.ids"];

/// The short word an operator calls the vendor, rather than its filed name.
///
/// `pci.ids` says "Intel Corporation" and "Advanced Micro Devices, Inc.
/// \[AMD/ATI\]", neither of which belongs in a line with a card name after it.
fn vendor_word(vendor: u16) -> Option<&'static str> {
    match vendor {
        0x8086 => Some("Intel"),
        0x1002 | 0x1022 => Some("AMD"),
        0x10de => Some("NVIDIA"),
        _ => None,
    }
}

/// The name on the box, where the entry carries one.
fn marketing_name(entry: &str) -> &str {
    let Some(open) = entry.find('[') else {
        return entry;
    };

    let Some(close) = entry[open..].find(']') else {
        return entry;
    };

    entry[open + 1..open + close].trim()
}

/// What the table calls a device, read the way the table is laid out.
///
/// Vendors start at the left margin and their devices are indented by one tab,
/// so a scan enters the vendor's block on its heading and leaves it at the next
/// unindented line. Subdevices are indented twice and are skipped: they name
/// the board a chip was sold on, which is a different question.
#[must_use]
pub fn lookup(table: &str, id: CardId) -> Option<String> {
    let vendor = format!("{:04x}", id.vendor);
    let device = format!("{:04x}", id.device);
    let mut inside = false;

    for line in table.lines() {
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }

        if !line.starts_with('\t') {
            if inside {
                return None;
            }

            inside = line.starts_with(&vendor);

            continue;
        }

        if !inside || line.starts_with("\t\t") {
            continue;
        }

        let entry = line.trim_start();

        if let Some(rest) = entry.strip_prefix(&device) {
            return Some(marketing_name(rest.trim()).to_owned());
        }
    }

    None
}

/// What to call a card the table could not name.
fn unnamed(id: CardId) -> String {
    let CardId { vendor, device } = id;

    match vendor_word(vendor) {
        Some(word) => format!("{word} graphics ({vendor:04x}:{device:04x})"),
        None => format!("Graphics device ({vendor:04x}:{device:04x})"),
    }
}

/// What to call a card, from whichever table this machine has.
pub async fn name(id: CardId) -> String {
    for path in TABLES {
        let Ok(table) = fs::read_to_string(path).await else {
            continue;
        };

        let Some(found) = lookup(&table, id) else {
            continue;
        };

        return match vendor_word(id.vendor) {
            Some(word) => format!("{word} {found}"),
            None => found,
        };
    }

    unnamed(id)
}

#[cfg(test)]
mod tests {
    use super::{lookup, unnamed, CardId};

    const TABLE: &str = "\
# Comment at the top
1002  Advanced Micro Devices, Inc. [AMD/ATI]
\t164e  Raphael
8086  Intel Corporation
\t4680  Alder Lake-S GT1 [UHD Graphics 770]
\t\t1043 8694  Gaming board
\t46a8  Alder Lake-P GT2
10de  NVIDIA Corporation
\t2786  AD104 [GeForce RTX 4070]
";

    #[test]
    fn takes_the_name_on_the_box_over_the_codename() {
        assert_eq!(
            lookup(
                TABLE,
                CardId {
                    vendor: 0x8086,
                    device: 0x4680
                }
            )
            .as_deref(),
            Some("UHD Graphics 770")
        );
    }

    #[test]
    fn keeps_a_codename_when_that_is_all_the_entry_has() {
        assert_eq!(
            lookup(
                TABLE,
                CardId {
                    vendor: 0x8086,
                    device: 0x46a8
                }
            )
            .as_deref(),
            Some("Alder Lake-P GT2")
        );
    }

    #[test]
    fn never_reads_a_device_out_of_another_vendors_block() {
        assert!(lookup(
            TABLE,
            CardId {
                vendor: 0x1002,
                device: 0x4680
            }
        )
        .is_none());
    }

    #[test]
    fn steps_over_the_board_a_chip_was_sold_on() {
        assert_eq!(
            lookup(
                TABLE,
                CardId {
                    vendor: 0x8086,
                    device: 0x1043
                }
            ),
            None,
            "a subdevice line must not be read as a device"
        );
    }

    #[test]
    fn says_nothing_about_a_device_the_table_does_not_list() {
        assert!(lookup(
            TABLE,
            CardId {
                vendor: 0x8086,
                device: 0xffff
            }
        )
        .is_none());
    }

    #[test]
    fn says_nothing_about_a_vendor_the_table_does_not_list() {
        assert!(lookup(
            TABLE,
            CardId {
                vendor: 0x1af4,
                device: 0x1050
            }
        )
        .is_none());
    }

    #[test]
    fn gives_the_identifiers_where_there_is_no_table_to_name_them() {
        assert_eq!(
            unnamed(CardId {
                vendor: 0x8086,
                device: 0x4680
            }),
            "Intel graphics (8086:4680)"
        );
    }

    #[test]
    fn names_a_vendor_it_has_no_short_word_for_by_its_numbers_alone() {
        assert_eq!(
            unnamed(CardId {
                vendor: 0x1af4,
                device: 0x1050
            }),
            "Graphics device (1af4:1050)"
        );
    }
}
