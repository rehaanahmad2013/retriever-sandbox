import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { readFileSync } from "fs";
import { join } from "path";
import pLimit from "p-limit";

const SID_URL = process.env.SID_URL;
const SID_API_KEY = process.env.SID_API_KEY;
const TOOL_BASE_URL = process.env.TOOL_BASE_URL;

if (!SID_URL || !SID_API_KEY || !TOOL_BASE_URL) {
  throw new Error("SID_URL, SID_API_KEY, and TOOL_BASE_URL must be set in environment variables");
}

const client = new OpenAI({
  baseURL: SID_URL,
  apiKey: SID_API_KEY,
  defaultHeaders: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
});

const systemPrompt = `You are an expert research assistant that retrieves relevant arXiv papers for a given research query. Your task is to find all arXiv paper IDs that are relevant to answering the research question.

Current date: ${new Date().toISOString().split('T')[0]}

Steps:
1. Reflect on what information is needed to answer the research question and use text_search to find relevant arXiv papers. Each paper has an arXiv ID.
2. Repeat step 1 until all papers necessary and sufficient to answer the question have been found. Take as many turns and searches as needed – you can make multiple searches per turn! Most questions will require multiple turns. Most questions require at least 5-8 search requests. Many will need more.
3. Use the report_helpful_ids tool to report the most helpful arXiv paper IDs. List the most helpful paper IDs first (important!).

The interaction ends once report_helpful_ids is called. You will be scored based on whether you have found all the relevant papers and whether you reported them in the correct order (NDCG).


You have access to the following tools:

- search: performs a semantic search with the query
  - Arguments: query (required), limit (optional, default 5, max 15)
- text_search: performs a full-text search of the user's inbox using Postgres TS_VECTOR webquery
  - Arguments: query (required), before (optional, ISO format), after (optional, ISO format), limit (optional, default 10, max 50)
- read: reads the full content of an arXiv paper by its ID
  - Arguments: id (required, arXiv paper ID)
- report_helpful_ids: report helpful arXiv paper IDs in order (most helpful first)
  - Arguments: ids (required, list of arXiv paper ID strings)

To use a tool, enclose it within <tool_call> tags with a Python dictionary containing "name" and "arguments". For example:

<tool_call>
{"name": "search", "arguments": {"query": "machine learning algorithms", "limit": 3}}
</tool_call>

The semantic search tool will match things that are conceptually related or use synonyms. This request above would also find texts that talk about linear regression, for example, although "linear regression" does not appear in the query directly. You can write long queries describing the document you want precisely with this tool.

<tool_call>
{"name": "text_search", "arguments": {"query": "machine learning algorithms", "limit": 3}}
</tool_call>

For text_search queries, you can use \"\" (escaped double quotes) to find exact matches for a term. Since the query is inside a JSON string with double quotes, you need to escape the inner double quotes with backslashes (\"dimensionality reduction\").
You can also use a - to exclude terms (like -PCA). You don't need to use \"\" or - operators, but it can be helpful. If your text_search query has too many terms, there might not be a paper that matches all the constraints and no data will be found.

The text_search tool returns snippets (relevant excerpts) rather than full papers. Snippets are approximately 50 words long and show the most relevant portion of the paper based on your query. If the paper was truncated, you'll see "..." at the beginning or end.
To read the full paper content, use the read_paper tool with the arXiv paper ID from your search results. You can only read papers that were previously returned by text_search.

<tool_call>
{"name": "read_paper", "arguments": {"id": "2301.12345"}}
</tool_call>

After you've received the tool responses, you can report the helpful arXiv paper IDs:

<tool_call>
{"name": "report_helpful_ids", "arguments": {"ids": ["2301.12345", "2302.67890", "2303.11111"]}}
</tool_call>`;

const MAX_TURNS = 10;

function formatSearchResultsAsXML(data: any): string {
  const results = data.results || [];
  
  return results.map((paper: any) => {
    const snippets = paper.occurrences?.map((occ: any) => occ.snippet).join("\n") || "";
    return `<doc id="${paper.universalId}" title="${paper.paperTitle}">\n${snippets}\n</doc>`;
  }).join("\n\n");
}

function formatEmbeddingSearchResultsAsXML(data: any): string {
  const results = data.results || [];
  
  return results.map((paper: any) => {
    return `<doc id="${paper.universalId}" title="${paper.title}">\n${paper.abstract}\n</doc>`;
  }).join("\n\n");
}

function formatPageAsXML(data: any): string {
  return `<doc id="${data.paperId}" title="Page ${data.pageNumber}">\n${data.text}\n</doc>`;
}

async function callTool(toolName: string, args: Record<string, any>): Promise<string> {
  let endpoint: string;
  let queryParams: Record<string, string> = {};

  if (toolName === "search") {
    endpoint = "/api/search/embedding";
    queryParams = {
      query: args.query,
      limit: String(args.limit || 10),
    };
    if (args.after) {
      queryParams.minPublicationDate = args.after;
    }
  } else if (toolName === "text_search") {
    endpoint = "/api/search/keyword";
    queryParams = {
      keyword: args.query,
      maxPapers: String(args.limit || 10),
    };
    if (args.after) {
      queryParams.minPublicationDate = args.after;
    }
  } else if (toolName === "read") {
    endpoint = "/api/page";
    queryParams = {
      universalId: args.id,
      pageNumber: String(args.pageNumber || 1),
    };
  } else if (toolName === "report_helpful_ids") {
    return "";
  } else {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const url = new URL(endpoint, TOOL_BASE_URL);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tool call failed (${response.status}): ${errorText}`);
  }

  const responseText = await response.text();
  const data = JSON.parse(responseText);

  if (toolName === "search") {
    return formatEmbeddingSearchResultsAsXML(data);
  } else if (toolName === "text_search") {
    return formatSearchResultsAsXML(data);
  } else if (toolName === "read") {
    return formatPageAsXML(data);
  }

  return responseText;
}

async function executeToolCalls(toolCalls: ChatCompletionMessageToolCall[]): Promise<{ tool_call_id: string; content: string }[]> {
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      if (toolCall.type !== "function") {
        throw new Error(`Unsupported tool call type: ${toolCall.type}`);
      }
      
      const { name, arguments: argsStr } = toolCall.function;
      const args = JSON.parse(argsStr);
      
      const content = await callTool(name, args);
      
      return {
        tool_call_id: toolCall.id,
        content,
      };
    })
  );

  return results;
}

async function runAgentLoop(query: string, verbose = false) {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: query },
  ];

  let turn = 0;
  let done = false;
  let reportedIds: string[] | null = null;

  while (!done && turn < MAX_TURNS) {
    turn++;
    if (verbose) console.log(`\n=== Turn ${turn} ===`);

    const response = await client.chat.completions.create({
      model: "sid-1",
      messages,
      tools: [
        { type: "function", function: { name: "search" } },
        { type: "function", function: { name: "text_search" } },
        { type: "function", function: { name: "read" } },
        { type: "function", function: { name: "report_helpful_ids" } },
      ],
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from model");
    }
    
    const assistantMessage = choice.message;
    
    const messageToAdd = {
      ...assistantMessage,
      content: assistantMessage.content || "",
    };
    messages.push(messageToAdd);

    if (verbose) {
      console.log("Assistant:", assistantMessage.content);
      console.log("Tool calls:", assistantMessage.tool_calls?.length || 0);
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      break;
    }

    if (verbose) console.log("\nTool calls:");
    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const args = JSON.parse(toolCall.function.arguments);
        if (verbose) console.log(`  - ${toolCall.function.name}:`, args);
        
        if (toolCall.function.name === "report_helpful_ids") {
          reportedIds = args.ids;
          done = true;
        }
      }
    }

    if (done) {
      break;
    }

    const toolResponses = await executeToolCalls(toolCalls);

    if (verbose) console.log("\nTool responses:");
    for (const toolResponse of toolResponses) {
      const content = toolResponse.content || "No content";
      
      messages.push({
        role: "tool",
        content,
        tool_call_id: toolResponse.tool_call_id,
      });
      
      if (verbose && content.trim().startsWith("<doc")) {
        const docCount = (content.match(/<doc /g) || []).length;
        const docIds = [...content.matchAll(/<doc id="([^"]+)"/g)].map(m => m[1]);
        console.log(`  Response: ${docCount} document(s) in XML format`);
        console.log(`  Document IDs:`, docIds);
      } else if (verbose && content) {
        console.log(`  Response:`, content.substring(0, 200));
      } else if (verbose) {
        console.log(`  Response: (empty)`);
      }
    }
  }

  if (verbose) {
    console.log("\n=== Final Results ===");
    console.log("Total turns:", turn);
    console.log("Reported IDs:", reportedIds);
  }

  return { messages, reportedIds, turnCount: turn };
}

function calculateNDCG(predictedIds: string[], groundTruthIds: string[], k?: number): number {
  const relevantIds = k ? predictedIds.slice(0, k) : predictedIds;
  
  const dcg = relevantIds.reduce((sum, id, index) => {
    const relevance = groundTruthIds.includes(id) ? 1 : 0;
    return sum + relevance / Math.log2(index + 2);
  }, 0);
  
  const idealRelevantIds = groundTruthIds.slice(0, relevantIds.length);
  const idcg = idealRelevantIds.reduce((sum, _, index) => {
    return sum + 1 / Math.log2(index + 2);
  }, 0);
  
  return idcg > 0 ? dcg / idcg : 0;
}

function calculateRecall(predictedIds: string[], groundTruthIds: string[], k?: number): number {
  const relevantIds = k ? predictedIds.slice(0, k) : predictedIds;
  const matches = relevantIds.filter(id => groundTruthIds.includes(id)).length;
  return groundTruthIds.length > 0 ? matches / groundTruthIds.length : 0;
}

function calculatePrecision(predictedIds: string[], groundTruthIds: string[], k?: number): number {
  const relevantIds = k ? predictedIds.slice(0, k) : predictedIds;
  const matches = relevantIds.filter(id => groundTruthIds.includes(id)).length;
  return relevantIds.length > 0 ? matches / relevantIds.length : 0;
}

interface QueryResult {
  query: string;
  groundTruth: string[];
  predicted: string[] | null;
  ndcg: number;
  ndcg5: number;
  ndcg10: number;
  recall: number;
  recall5: number;
  recall10: number;
  precision: number;
  precision5: number;
  precision10: number;
  turns: number;
  error?: string;
}

async function evaluateAll() {
  const combinedPath = join(process.cwd(), "db/scripts/combined.json");
  const queries = JSON.parse(readFileSync(combinedPath, "utf-8")) as Array<{
    query: string;
    papers: string[];
  }>;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Starting evaluation on ${queries.length} queries with concurrency limit of 10`);
  console.log(`${"=".repeat(80)}\n`);

  const limit = pLimit(10);
  let completed = 0;

  const evaluateSingle = async (queryData: { query: string; papers: string[] }, index: number): Promise<QueryResult> => {
    const { query, papers: groundTruth } = queryData;
    
    try {
      const result = await runAgentLoop(query, false);
      const predicted = result.reportedIds || [];
      
      const ndcg = calculateNDCG(predicted, groundTruth);
      const ndcg5 = calculateNDCG(predicted, groundTruth, 5);
      const ndcg10 = calculateNDCG(predicted, groundTruth, 10);
      
      const recall = calculateRecall(predicted, groundTruth);
      const recall5 = calculateRecall(predicted, groundTruth, 5);
      const recall10 = calculateRecall(predicted, groundTruth, 10);
      
      const precision = calculatePrecision(predicted, groundTruth);
      const precision5 = calculatePrecision(predicted, groundTruth, 5);
      const precision10 = calculatePrecision(predicted, groundTruth, 10);
      
      completed++;
      console.log(`[${completed}/${queries.length}] Completed query ${index + 1}`);
      
      return {
        query,
        groundTruth,
        predicted,
        ndcg,
        ndcg5,
        ndcg10,
        recall,
        recall5,
        recall10,
        precision,
        precision5,
        precision10,
        turns: result.turnCount,
      };
    } catch (error) {
      completed++;
      console.log(`[${completed}/${queries.length}] Failed query ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        query,
        groundTruth,
        predicted: null,
        ndcg: 0,
        ndcg5: 0,
        ndcg10: 0,
        recall: 0,
        recall5: 0,
        recall10: 0,
        precision: 0,
        precision5: 0,
        precision10: 0,
        turns: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const results = await Promise.all(
    queries.map((queryData, index) => limit(() => evaluateSingle(queryData, index)))
  );

  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`DETAILED RESULTS`);
  console.log(`${"=".repeat(80)}\n`);

  results.forEach((result, i) => {
    console.log(`\n[${"=".repeat(76)}]`);
    console.log(`Query ${i + 1}/${results.length}`);
    console.log(`[${"=".repeat(76)}]`);
    console.log(`Query: ${result.query}`);
    console.log(`Ground truth papers: ${result.groundTruth.length} - [${result.groundTruth.join(", ")}]`);
    
    if (result.error) {
      console.log(`\nERROR: ${result.error}`);
    } else {
      console.log(`\nPredicted papers: ${result.predicted?.length || 0}`);
      console.log(`Predicted IDs: ${result.predicted?.join(", ") || "none"}`);
      console.log(`\nMetrics:`);
      console.log(`  NDCG:        ${result.ndcg.toFixed(4)}  (NDCG@5: ${result.ndcg5.toFixed(4)}, NDCG@10: ${result.ndcg10.toFixed(4)})`);
      console.log(`  Recall:      ${result.recall.toFixed(4)}  (Recall@5: ${result.recall5.toFixed(4)}, Recall@10: ${result.recall10.toFixed(4)})`);
      console.log(`  Precision:   ${result.precision.toFixed(4)}  (Precision@5: ${result.precision5.toFixed(4)}, Precision@10: ${result.precision10.toFixed(4)})`);
      console.log(`  Turns:       ${result.turns}`);
    }
  });

  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`FINAL AGGREGATE METRICS`);
  console.log(`${"=".repeat(80)}\n`);

  const successfulResults = results.filter(r => !r.error);
  const failedCount = results.length - successfulResults.length;

  if (successfulResults.length > 0) {
    const avgNDCG = successfulResults.reduce((sum, r) => sum + r.ndcg, 0) / successfulResults.length;
    const avgNDCG5 = successfulResults.reduce((sum, r) => sum + r.ndcg5, 0) / successfulResults.length;
    const avgNDCG10 = successfulResults.reduce((sum, r) => sum + r.ndcg10, 0) / successfulResults.length;
    
    const avgRecall = successfulResults.reduce((sum, r) => sum + r.recall, 0) / successfulResults.length;
    const avgRecall5 = successfulResults.reduce((sum, r) => sum + r.recall5, 0) / successfulResults.length;
    const avgRecall10 = successfulResults.reduce((sum, r) => sum + r.recall10, 0) / successfulResults.length;
    
    const avgPrecision = successfulResults.reduce((sum, r) => sum + r.precision, 0) / successfulResults.length;
    const avgPrecision5 = successfulResults.reduce((sum, r) => sum + r.precision5, 0) / successfulResults.length;
    const avgPrecision10 = successfulResults.reduce((sum, r) => sum + r.precision10, 0) / successfulResults.length;
    
    const avgTurns = successfulResults.reduce((sum, r) => sum + r.turns, 0) / successfulResults.length;

    console.log(`Total queries:        ${results.length}`);
    console.log(`Successful:           ${successfulResults.length}`);
    console.log(`Failed:               ${failedCount}`);
    console.log();
    console.log(`Average NDCG:         ${avgNDCG.toFixed(4)}`);
    console.log(`Average NDCG@5:       ${avgNDCG5.toFixed(4)}`);
    console.log(`Average NDCG@10:      ${avgNDCG10.toFixed(4)}`);
    console.log();
    console.log(`Average Recall:       ${avgRecall.toFixed(4)}`);
    console.log(`Average Recall@5:     ${avgRecall5.toFixed(4)}`);
    console.log(`Average Recall@10:    ${avgRecall10.toFixed(4)}`);
    console.log();
    console.log(`Average Precision:    ${avgPrecision.toFixed(4)}`);
    console.log(`Average Precision@5:  ${avgPrecision5.toFixed(4)}`);
    console.log(`Average Precision@10: ${avgPrecision10.toFixed(4)}`);
    console.log();
    console.log(`Average Turns:        ${avgTurns.toFixed(2)}`);
  } else {
    console.log(`All queries failed!`);
  }

  if (failedCount > 0) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`FAILED QUERIES (${failedCount})`);
    console.log(`${"=".repeat(80)}\n`);
    results.filter(r => r.error).forEach((r, i) => {
      console.log(`${i + 1}. ${r.query}`);
      console.log(`   Error: ${r.error}\n`);
    });
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

evaluateAll().catch(console.error);