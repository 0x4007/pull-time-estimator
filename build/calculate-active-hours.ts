import { Endpoints } from "@octokit/types";
import axios from "axios";
import { Command } from "commander";
import { DBSCAN } from "density-clustering";
import * as dotenv from "dotenv";
import moment from "moment";
import * as process from "process";

dotenv.config();

const program = new Command();

program
  .option("-o, --org <org>", "GitHub organization")
  .option("-r, --repo <repo>", "GitHub repository")
  .option("-p, --pull <pull>", "Pull request number")
  .parse(process.argv);

const options = program.opts();

const { org, repo, pull } = options;

if (!org || !repo || !pull) {
  console.error("Organization, repository, and pull request number are required.");
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

async function fetchCommits(org: string, repo: string, pull: number): Promise<Commit[]> {
  const url = `https://api.github.com/repos/${org}/${repo}/pulls/${pull}/commits`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };

  const response = await axios.get<GitHubCommit[]>(url, { headers });
  return response.data.map((commit: GitHubCommit) => ({
    sha: commit.sha,
    date: commit.commit.author?.date || "",
  }));
}

function calculateActiveHours(commitData: Commit[]): number {
  const sortedCommits = commitData.map((commit) => ({ ...commit, date: moment(commit.date) })).sort((a, b) => a.date.valueOf() - b.date.valueOf());

  const timeDiffsSeconds = sortedCommits.map((commit, index) => {
    if (index === 0) return 0;
    return sortedCommits[index].date.diff(sortedCommits[index - 1].date, "seconds");
  });

  const dbscan = new DBSCAN();
  const clusters = dbscan.run(
    timeDiffsSeconds.map((diff) => [diff]),
    3600,
    1
  );

  const clusteredTimes = clusters.map((cluster) => cluster.reduce((sum, index) => sum + timeDiffsSeconds[index], 0));

  const filteredClusterTimes = clusteredTimes.filter((time) => time > 1800);

  const totalActiveTimeSeconds = filteredClusterTimes.reduce((sum, time) => sum + time, 0);
  return totalActiveTimeSeconds / 3600;
}

async function main(): Promise<void> {
  try {
    const commits = await fetchCommits(org, repo, pull);
    const activeHours = calculateActiveHours(commits);
    console.log(`Total active hours: ${activeHours.toFixed(2)}`);
  } catch (error) {
    console.error("Error fetching commits or calculating active hours:", error);
  }
}

void main();