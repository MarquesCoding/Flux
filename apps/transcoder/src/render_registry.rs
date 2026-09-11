//! Keeping track of the renders that are under way, and of why one failed.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;

/// What is being drawn right now, and what went wrong the last time it was.
///
/// Shared by previews and by thumbnail sheets, which had a copy each. The two
/// copies drifted — sheets grew the ability to remember a failure and clips
/// never did, so a clip that failed in the background had nobody to tell and
/// whoever asked next started the same doomed render again.
#[derive(Clone, Default)]
pub struct RenderRegistry {
    in_flight: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
    failures: Arc<Mutex<HashMap<String, String>>>,
}

impl RenderRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// The lock for one address, so two callers draw it once between them.
    pub async fn gate(&self, id: &str) -> Arc<Mutex<()>> {
        let mut in_flight = self.in_flight.lock().await;

        Arc::clone(in_flight.entry(id.to_owned()).or_default())
    }

    /// Takes this render, unless something already has.
    ///
    /// A caller that means to draw in the background has to say so before it
    /// spawns anything, because the work sits in a queue before it begins and
    /// nothing is marked as under way until it does. Without this, every ask
    /// while a long render was still queued started another one: a 4K remux
    /// asked about every five seconds gathered fourteen jobs for one film.
    ///
    /// The caller that is told yes owns the release.
    pub async fn claim(&self, id: &str) -> bool {
        let mut in_flight = self.in_flight.lock().await;

        if in_flight.contains_key(id) {
            return false;
        }

        in_flight.insert(id.to_owned(), Arc::default());

        true
    }

    /// Remembers that a render failed, for whoever asks next.
    ///
    /// A render that fails in the background has nobody to tell. Without this
    /// the next ask finds no claim and nothing drawn, starts another render,
    /// and fails the same way for ever — which is what a deadline used to stand
    /// in for. Kept until it is read so the answer reaches whoever asks next,
    /// and cleared by reading so a later ask is free to try again.
    pub async fn remember_failure(&self, id: &str, reason: String) {
        self.failures.lock().await.insert(id.to_owned(), reason);
    }

    /// Takes what went wrong, where anything did, and forgets it.
    pub async fn take_failure(&self, id: &str) -> Option<String> {
        self.failures.lock().await.remove(id)
    }

    /// Lets go of a claim whose work never ran.
    ///
    /// A render releases its own claim when it finishes, so this is only
    /// reached where the work was dropped before it began — a queue shut down
    /// mid-render, say. Without it the claim would outlive the process's
    /// interest in it and that film could never be asked for again.
    pub async fn give_up(&self, id: &str) {
        self.release(id).await;
    }

    /// Lets go of an address once nobody else is holding its gate.
    pub async fn release(&self, id: &str) {
        let mut in_flight = self.in_flight.lock().await;

        if in_flight
            .get(id)
            .is_some_and(|gate| Arc::strong_count(gate) <= 2)
        {
            in_flight.remove(id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RenderRegistry;

    #[tokio::test]
    async fn lets_the_first_caller_take_a_render_and_turns_the_second_away() {
        let registry = RenderRegistry::new();

        assert!(registry.claim("abc").await);
        assert!(!registry.claim("abc").await);
    }

    #[tokio::test]
    async fn frees_an_address_once_the_claim_is_given_up() {
        let registry = RenderRegistry::new();

        assert!(registry.claim("abc").await);
        registry.give_up("abc").await;
        assert!(registry.claim("abc").await, "it should be free again");
    }

    /// Kept until read, so the answer reaches whoever asks next.
    #[tokio::test]
    async fn hands_a_failure_to_the_next_asker_and_forgets_it() {
        let registry = RenderRegistry::new();

        registry
            .remember_failure("abc", "that file has no video stream".to_owned())
            .await;

        assert_eq!(
            registry.take_failure("abc").await.as_deref(),
            Some("that file has no video stream")
        );
        assert_eq!(
            registry.take_failure("abc").await,
            None,
            "reading clears it"
        );
    }

    #[tokio::test]
    async fn keeps_one_address_apart_from_another() {
        let registry = RenderRegistry::new();

        registry.remember_failure("abc", "broke".to_owned()).await;

        assert_eq!(registry.take_failure("def").await, None);
        assert!(registry.claim("def").await);
    }
}
