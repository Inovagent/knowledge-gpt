const BUTTON_ID = "yt-transcript-to-notion-button";
const BUTTON_CONTAINER_ID = "yt-transcript-to-notion-container";
const WATCH_PATH = "/watch";
const PROCESSED_VIDEOS_KEY = "processedVideos";

const ICONS = {
  idle: `
    <div aria-hidden="true" class="yt-transcript-to-notion__elevated">
      <span class="yt-transcript-to-notion__icon-shell">
        <span class="yt-transcript-to-notion__icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v10"></path>
            <path d="m8 10 4 4 4-4"></path>
            <path d="M5 19h14"></path>
          </svg>
        </span>
      </span>
    </div>
    <span aria-hidden="true" class="yt-transcript-to-notion__feedback"></span>
    <span aria-hidden="true" class="yt-transcript-to-notion__light"></span>
  `,
  loading: `
    <div aria-hidden="true" class="yt-transcript-to-notion__elevated">
      <span aria-hidden="true" class="yt-transcript-to-notion__icon-shell">
        <span class="yt-transcript-to-notion__icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="is-spinning">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </span>
      </span>
    </div>
    <span aria-hidden="true" class="yt-transcript-to-notion__feedback"></span>
    <span aria-hidden="true" class="yt-transcript-to-notion__light"></span>
  `,
  saved: `
    <div aria-hidden="true" class="yt-transcript-to-notion__elevated">
      <span class="yt-transcript-to-notion__icon-shell">
        <span class="yt-transcript-to-notion__icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5"></path>
          </svg>
        </span>
      </span>
    </div>
    <span aria-hidden="true" class="yt-transcript-to-notion__feedback"></span>
    <span aria-hidden="true" class="yt-transcript-to-notion__light"></span>
  `,
  skipped: `
    <div aria-hidden="true" class="yt-transcript-to-notion__elevated">
      <span class="yt-transcript-to-notion__icon-shell">
        <span class="yt-transcript-to-notion__icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h16"></path>
            <path d="M16 6l4 6-4 6"></path>
          </svg>
        </span>
      </span>
    </div>
    <span aria-hidden="true" class="yt-transcript-to-notion__feedback"></span>
    <span aria-hidden="true" class="yt-transcript-to-notion__light"></span>
  `,
  error: `
    <div aria-hidden="true" class="yt-transcript-to-notion__elevated">
      <span class="yt-transcript-to-notion__icon-shell">
        <span class="yt-transcript-to-notion__icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          </svg>
        </span>
      </span>
    </div>
    <span aria-hidden="true" class="yt-transcript-to-notion__feedback"></span>
    <span aria-hidden="true" class="yt-transcript-to-notion__light"></span>
  `
};
