import { Endpoints } from "@octokit/types";
import axios from "axios";
import { Command } from "commander";
import { DBSCAN } from "density-clustering";
import * as dotenv from "dotenv";
import moment from "moment";
import * as process from "process";

dotenv.config();

const program = new Command();

program.option("-u, --url <url>", "GitHub pull request URL").parse(process.argv);

const options = program.opts();

const { url } = options;

if (!url) {
  console.error("GitHub pull request URL is required.");
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("GitHub token is required. Set it in the .env file or as an environment variable.");
  process.exit(1);
}

type GitHubCommit = Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/commits"]["response"]["data"][number];

interface Commit {
  sha: string;
  date: string;
}

function parseGitHubUrl(pullUrl: string): { org: string; repo: string; pull: number } {
  const match = pullUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error("Invalid GitHub pull request URL.");
  }
  return { org: match[1], repo: match[2], pull: parseInt(match[3], 10) };
}

async function fetchCommits(org: string, repo: string, pull: number): Promise<Commit[]> {
  const apiUrl = `https://api.github.com/repos/${org}/${repo}/pulls/${pull}/commits`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };

  const response = await axios.get<GitHubCommit[]>(apiUrl, { headers });
  return response.data.map((commit: GitHubCommit) => ({
    sha: commit.sha,
    date: commit.commit.author?.date || "",
  }));
}

function calculateActiveHours(commitData: Commit[]): number {
  if (commitData.length === 0) {
    console.error("No commits found.");
    return 0;
  }

  const sortedCommits = commitData.map((commit) => ({ ...commit, date: moment(commit.date) })).sort((a, b) => a.date.valueOf() - b.date.valueOf());

  const timeDiffsSeconds = sortedCommits.map((commit, index) => {
    if (index === 0) return 0;
    return sortedCommits[index].date.diff(sortedCommits[index - 1].date, "seconds");
  });

  console.log("Time differences in seconds:", timeDiffsSeconds);

  const dbscan = new DBSCAN();
  const clusters = dbscan.run(
    timeDiffsSeconds.map((diff) => [diff]),
    3600,
    1
  );

  console.log("Clusters:", clusters);

  const clusteredTimes = clusters.map((cluster) => cluster.reduce((sum, index) => sum + timeDiffsSeconds[index], 0));

  console.log("Clustered times:", clusteredTimes);

  const totalActiveTimeSeconds = clusteredTimes.reduce((sum, time) => sum + time, 0);
  const totalActiveHours = totalActiveTimeSeconds / 3600;

  // Round to the nearest half hour
  return Math.round(totalActiveHours * 2) / 2;
}

export async function main(): Promise<void> {
  try {
    const { org, repo, pull } = parseGitHubUrl(url);
    console.log(`Fetching commits for ${org}/${repo}#${pull}`);
    const commits = await fetchCommits(org, repo, pull);
    console.log(`Fetched ${commits.length} commits.`);
    const activeHours = calculateActiveHours(commits);
    console.log(`Total active hours: ${activeHours.toFixed(2)}`);
  } catch (error) {
    console.error("Error fetching commits or calculating active hours:", error);
  }
}
