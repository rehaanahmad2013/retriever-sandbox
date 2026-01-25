import { getPaperByUniversalId } from "../services/papers";

const PAPER_ID = "your-paper-universal-id-here";

console.log(`Fetching paper with universal ID: ${PAPER_ID}\n`);

const paper = await getPaperByUniversalId(PAPER_ID);

if (!paper) {
  console.log("Paper not found.");
  process.exit(1);
}

console.log("Paper found:");
console.log(`  ID: ${paper.id}`);
console.log(`  Title: ${paper.title}`);
console.log(`  Universal ID: ${paper.universalId}`);
console.log(`  Publication Date: ${paper.publicationDate}`);
console.log(`  Votes: ${paper.votes}`);
console.log(`  Abstract: ${paper.abstract.substring(0, 200)}...`);

process.exit(0);
