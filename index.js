const sodium = require("tweetsodium");
const { exec } = require("child_process");
const { owner, repo, envpath } = require("yargs/yargs")(process.argv.slice(2)).argv;

if (!owner) {
	console.log("Repo Owner is required!");
	process.exit(0);
} else if (!repo) {
	console.log("Repo Name is required!");
	process.exit(0);
} else if (!envpath) {
	console.log("Env Path is not provided, using .env");
}

const env = require("dotenv").config({ path: envpath ?? ".env" });

const getPublicKey = `gh api \
  -H "Accept: application/vnd.github.v3+json" \
  /repos/${owner}/${repo}/actions/secrets/public-key `;

exec(getPublicKey, (error, stdout, stderr) => {
	if (error) {
		console.log(`error: ${error.message}`);
		return;
	} else if (stderr) {
		console.log(`stderr: ${stderr}`);
		return;
	}

	const res = JSON.parse(stdout);

	const KEY = res.key_id;
	const KEY_BYTES = Buffer.from(res.key, "base64");

	const getCommand = (key, value) => `gh api \
  --method PUT \
  -H "Accept: application/vnd.github.v3+json" \
  /repos/${owner}/${repo}/actions/secrets/${key} \
  -f encrypted_value='${value}' \
  -f key_id='${KEY}'`;

	const encrypt = (value) => {
		const messageBytes = Buffer.from(value);
		const encryptedBytes = sodium.seal(messageBytes, KEY_BYTES);

		return Buffer.from(encryptedBytes).toString("base64");
	};

	Object.keys(env.parsed).map((key) => {
		const value = env.parsed[key];
		console.log(key, value);

		exec(getCommand(key, encrypt(value)), (error, _, stderr) => {
			if (error) {
				console.log(`error: ${error.message}`);
				return;
			} else if (stderr) {
				console.log(`stderr: ${stderr}`);
				return;
			}

			console.log(`Key ${key} set!`);
		});
	});
});
