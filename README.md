# yarn-exclude

### Overview

This library is intended mainly for deploying a single package in a yarn monorepo to a CI environment, (which will often run yarn install from the monorepo root), without needing to install all dependencies from unused sibling packages. This is done by temporarily modifying package.json to only contain the non-excluded workspaces before running `yarn install` (essentially simulating what would happen if the excluded packages were never present). It will not check if the excluded workspace is actually depended upon or not by the included ones; you'll want to make sure of that before using this.

### Usage

If we have following `workspaces` config:

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
npx yarn-exclude -e one,two
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

Glob and array notation are supported as well,
for example:

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

`--modify` Leave yarn.lock and package.json modifications in place after the operation completes. May be useful in some CI environments (e.g., if yarn install is run a second time later on.)

`-V, --version` output the version number

`-h, --help` display help for command options

### Caveats

- Passing additional CLI options to the underlying `yarn install` is not currently supported.
- It's important to emphasize that this package doesn't do anything especially clever- it simply removes the specified packages from `workspaces` in package.json, runs `yarn install`, and restores package.json and yarn.lock to their original forms. If you're concerned by any implications of that, I'd recommend not using this library, or doing test runs with the `--modify` option and observing the output to make sure you fully understand the effects. For example, in some cases exact versions of yarn.lock entries may change (however, this is also true of regular `yarn install` if you aren't using `--frozen-lockfile` with it.)
