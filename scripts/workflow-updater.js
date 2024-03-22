const fs = require('fs');
const { Octokit } = require("@octokit/rest");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const octokit = new Octokit({ auth: process.env.WORKFLOW_GITHUB_TOKEN });

const filePath = argv.filePath || '../docs/workflow-status.md'; // Use the filePath argument or default to '../docs/workflow-status.md'
const content = fs.readFileSync(filePath, 'utf8');

const regex = /<!-- workflow_url:\s*(https:\/\/github\.com\/[^\/]+\/[^\/]+\/actions\/workflows\/[^\.]+\.yml) -->/g;

let updatedContent = content;

let match;
while ((match = regex.exec(content)) !== null) {
    const currentMatch = match; // Create a local copy of match
    const url = currentMatch[1];
    const parts = url.split('/');
    const owner = parts[3];
    const repo = parts[4];
    const workflow_file = parts.slice(7).join('/');

    octokit.actions.listRepoWorkflows({
        owner,
        repo
    }).then(response => {
        const workflows = response.data.workflows;
        const workflow = workflows.find(w => w.path === `.github/workflows/${workflow_file}`);

        if (workflow) {
            octokit.actions.listWorkflowRuns({
                owner,
                repo,
                workflow_id: workflow.id,
                per_page: 1
            }).then(response => {
              if (response.data.workflow_runs.length === 0) {
                  // Skip if there are no workflow runs
                  return;
              }
                const run = response.data.workflow_runs[0];
                // https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-workflow
                const statusColors = {
                    'completed': '2ea44f',
                    'action_required': 'yellow',
                    'cancelled': 'gray',
                    'failure': 'red',
                    'neutral': 'gray',
                    'skipped': 'gray',
                    'stale': 'gray',
                    'success': '2ea44f',
                    'timed_out': 'red',
                    'in_progress': 'yellow',
                    'queued': 'yellow',
                    'requested': 'yellow',
                    'waiting': 'blue',
                    'pending': 'yellow'
                };

                const status = run.status === 'completed' ? (run.conclusion === 'success' ? 'success' : run.conclusion) : run.status;
                const color = statusColors[status] || 'gray';
                const badge = `[![${run.name} - ${status}](https://img.shields.io/static/v1?label=${run.name.replace(/ /g, '%20')}&message=${status.replace(/ /g, '%20')}&color=${color})](${url})`;                const badgeRegex = new RegExp(`(${currentMatch[0]}\\n\\n\\[!\\[.*?\\]\\(https:\\/\\/img\\.shields\\.io\\/.*?\\)\\]\\(${url}\\)|${currentMatch[0]})`, 'g');
                const newContent = `${currentMatch[0]}\n\n${badge}`;

                updatedContent = updatedContent.replace(badgeRegex, newContent);

                fs.writeFileSync(filePath, updatedContent, 'utf8');
            });
        }
    });
}
