# Pull Request Work Time Estimator

A CLI tool to estimate the active hours spent on a GitHub pull request. This tool fetches the commits associated with a specified pull request and calculates the active hours based on commit activity, rounding to the nearest half-hour interval.

## Prerequisites

- Node.js
- yarn

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/0x4007/pull-time-estimator.git
   cd pull-time-estimator
   ```

2. Install the dependencies:

   ```sh
   yarn install
   ```

3. Create a `.env` file in the root directory and add your GitHub token:
   ```
   GITHUB_TOKEN=your_github_token
   ```

## Usage

```sh
npx tsx build -u <GitHub Pull Request URL>
```

### Example

```sh
npx tsx build -u https://github.com/ubiquibot/command-query-user/pull/6
```

### Options

- `-u, --url <url>`: GitHub pull request URL (required)

## How It Works

1. **Fetch Commits**: The tool fetches all commits associated with the specified pull request.
2. **Calculate Time Differences**: It calculates the time differences between consecutive commits.
3. **Clustering**: Using the DBSCAN algorithm, it clusters the commit activities based on time differences.
4. **Calculate Active Hours**: It sums up the time spent on each cluster and converts it into hours.
5. **Round to Nearest Half-Hour**: The total active hours are rounded to the nearest half-hour interval.
