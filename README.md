# yarn-exclude

### Overview

This library provides a way to exclude packages in a yarn monorepo when running `yarn install`, only installing dependencies for the desired workspaces. The main intended use case is for easily deploying a single workspace to a CI environment, without the overhead of dependencies from all sibling packages being installed.

This is accomplished by temporarily modifying package.json to only contain the non-excluded workspaces before running `yarn install` (essentially simulating what would happen if the excluded packages were never present in the first place). 




### Usage

If we have the following `workspaces` config:

```
  "workspaces": {
    "packages": [
      "packages/one",
      "packages/two",
      "packages/three"
    ],
    "nohoist": ["react"]
  },
```

And we run:

```
//bypass interactive prompt for CI
npm_config_yes=true npx yarn-exclude -e one,two
```

The result is equivalent to having a `workspaces` config of:

```
  "workspaces": {
    "packages": [
      "packages/three"
    ],
    "nohoist": ["react"]
  },
```

and running `yarn install`.

Glob and array notation for `workspaces` will also work.

```
  "workspaces": [
      "packages/*"
  },
```



### Options

`-e --exclude <excluded packages>` Comma separated list of excluded package
dirnames. (Required)

`--cwd <directory>` workspace root directory. (Default:
current working directory)

`--modify` Leave yarn.lock and package.json modifications in place after the operation completes. May be useful in some CI environments.

`-V, --version` output the version number

`-h, --help` display help for command options



### Caveats

* Passing additional CLI options to the underlying `yarn install` is not currently supported.
* `yarn-exclude` will not check if the excluded workspace is actually depended upon or not by any of the included ones; you'll have to make sure of that yourself before running this.
* This package doesn't do anything fancy- it simply removes the specified packages from `workspaces` in package.json, runs `yarn install`, and restores package.json and yarn.lock to their original forms.
* If you're concerned by any implications of the above, I'd recommend either not using this library, or doing test runs with the `--modify` option and observing the output to make sure you fully understand the effects. For example, in some cases exact versions of yarn.lock entries may change (however, this is also true of regular `yarn install` if you aren't using `--frozen-lockfile` with it.)
