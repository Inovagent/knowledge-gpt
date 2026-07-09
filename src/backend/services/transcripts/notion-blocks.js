const {
  BODY_BLOCK_LIMIT,
  CONTENT_HEADING,
  CODE_SEGMENTS_PER_BLOCK,
  RICH_TEXT_CHUNK_SIZE,
  TRANSCRIPT_HEADING
} = require("./constants");

function chunkText(text, size) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function chunkBlocks(blocks, size = BODY_BLOCK_LIMIT) {
  return chunkArray(blocks, size);
}

function buildTranscriptBlocks(transcript, heading = TRANSCRIPT_HEADING) {
  const normalizedTranscript = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  const transcriptSegments = chunkText(normalizedTranscript, RICH_TEXT_CHUNK_SIZE);
  const codeBlockSegments = chunkArray(transcriptSegments, CODE_SEGMENTS_PER_BLOCK);

  const blocks = [
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: heading } }]
      }
    }
  ];

  for (const segmentGroup of codeBlockSegments) {
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: segmentGroup.map((segment) => ({
          type: "text",
          text: { content: segment }
        })),
        language: "plain text"
      }
    });
  }

  return blocks;
}

function getContentHeading(payload = {}) {
  const headings = {
    article: "Article",
    email: CONTENT_HEADING,
    selection: "Selection",
    transcript: TRANSCRIPT_HEADING
  };

  return headings[payload.contentType] || CONTENT_HEADING;
}

module.exports = {
  buildTranscriptBlocks,
  chunkBlocks,
  getContentHeading
};
