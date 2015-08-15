'use babel'
import concatStream from 'concat-stream';
import conventionalChangelog from 'conventional-changelog';
import conventionalCommitsDetector from 'conventional-commits-detector';
import conventionalGithubReleaser from 'conventional-github-releaser';
import gitRawCommits from 'git-raw-commits';
import loophole from 'loophole';
import path from 'path';
import through from 'through2';

function chdirToRepo() {
  const editor = atom.workspace.getActiveTextEditor();

	if (!editor) {
		return;
	}

  const file = editor.getURI();

  // hack
  process.chdir(path.dirname(file));
}

function getConfigs(done) {
  let preset = atom.config.get('conventional-changelog.preset').toLowerCase();
  let append = atom.config.get('conventional-changelog.append');
  let releaseCount = atom.config.get('conventional-changelog.releaseCount');

  if (preset === 'auto') {
    loophole.allowUnsafeNewFunctionAsync((unsafeDone) => {
      let commits = [];

      gitRawCommits()
        .on('error', (err) => {
          err.message = 'Error in git-raw-commits: ' + err.message;
          done(err);
          unsafeDone();
        })
        .pipe(through((data, enc, cb) => {
          commits.push(data.toString());
          cb();
        }, () => {
          preset = conventionalCommitsDetector(commits);

          done(null, [{
            preset,
            append,
            releaseCount
          }]);
          unsafeDone();
        }));
      })
    return;
  }

  done(null, [{
    preset,
    append,
	  releaseCount
  }]);
}

function changelog() {
  chdirToRepo();

  const editor = atom.workspace.getActiveTextEditor();
  let text = editor.getText();

  getConfigs((err, data) => {
    if (err) {
      console.error(err);
      atom.beep();
      return;
    }

    let configs = data;
    let opts = configs[0];

    loophole.allowUnsafeNewFunctionAsync((unsafeDone) => {
      return conventionalChangelog(...configs)
        .on('error', function(err) {
          err.message = 'Error in conventional-changelog: ' + err.message;
          console.error(err);
          atom.beep();
          unsafeDone();
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
          unsafeDone();
        }));
    });
  });
}

function githubRelease() {
  chdirToRepo();
  getConfigs((err, data) => {
    if (err) {
      console.error(err);
      atom.beep();
      return;
    }

    let configs = data;

    loophole.allowUnsafeNewFunctionAsync((unsafeDone) => {
      return conventionalGithubReleaser({
        type: 'token'
      }, ...configs, (err, data) => {
        if (err) {
          err.message = 'Error in conventional-github-releaser: ' + err.message;
          console.error(err);
          atom.beep();
          unsafeDone();
        }

        unsafeDone();
      });
    });
  });
}

export let config = {
  preset: {
    type: 'string',
    description: 'auto, angular, atom, ember, eslint, express, jquery, jscs, jshint or codemirror.',
    default: 'auto'
  },
  append: {
    type: 'boolean',
    description: 'Should the log be appended to existing data.',
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
