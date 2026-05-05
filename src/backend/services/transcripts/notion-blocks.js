const {
  BODY_BLOCK_LIMIT,
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

function buildTranscriptBlocks(transcript) {
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
        rich_text: [{ type: "text", text: { content: TRANSCRIPT_HEADING } }]
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

module.exports = {
  buildTranscriptBlocks,
  chunkBlocks
};
