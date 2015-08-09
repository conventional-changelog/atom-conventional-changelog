'use babel'
import conventionalChangelog from 'conventional-changelog';
import conventionalCommitsDetector from 'conventional-commits-detector';
import conventionalGithubReleaser from 'conventional-github-releaser';
import concatStream from 'concat-stream';
import loophole from 'loophole';
import path from 'path';

function chdirToRepo() {
  const editor = atom.workspace.getActiveTextEditor();

	if (!editor) {
		return;
	}

  const file = editor.getURI();

  // hack
  process.chdir(path.dirname(file));
}

function getConfigs() {
  return [{
    preset: atom.config.get('conventional-changelog.preset'),
    append: atom.config.get('conventional-changelog.append'),
	  releaseCount: atom.config.get('conventional-changelog.releaseCount')
  }];
}

function changelog() {
  chdirToRepo();

  const editor = atom.workspace.getActiveTextEditor();
  let text = editor.getText();

  loophole.allowUnsafeNewFunctionAsync((done) => {
    let configs = getConfigs();
    let opts = configs[0];

    return conventionalChangelog(...configs)
      .on('error', function(err) {
        err.message = 'Error in conventional-changelog: ' + err.message;
        console.error(err);
        atom.beep();
      })
      .pipe(concatStream((data) => {
        data = data.toString();

        if (opts.releaseCount === 0) {
          text = data;
        } else if (opts.append) {
          text = text + data;
        } else if (!opts.append) {
          text = data + text;
        }

        editor.setText(text);
        done();
      }));
  });
}

function githubRelease() {
  chdirToRepo();

  loophole.allowUnsafeNewFunctionAsync((done) => {
    return conventionalGithubReleaser({
      type: 'token'
    }, ...getConfigs(), (err, data) => {
      if (err) {
        err.message = 'Error in conventional-github-releaser: ' + err.message;
        console.error(err);
        atom.beep();
      }

      console.log(data);
      done();
    });
  });
}

export let config = {
  preset: {
    type: 'string',
    description: 'A set of options of a popular project so you don\'t have to define everything in options, context, gitRawCommitsOpts, parserOpts or writerOpts manually.',
    default: 'angular'
  },
  append: {
    type: 'boolean',
    description: 'Should the log be appended.',
    default: false
  },
	releaseCount: {
    type: 'number',
    description: 'How many releases of changelog you want to generate.',
		default: 1
	}
};

export let activate = () => {
	atom.commands.add('atom-workspace', 'conventional-changelog:changelog', changelog);
  atom.commands.add('atom-workspace', 'conventional-changelog:githubRelease', githubRelease);
};
