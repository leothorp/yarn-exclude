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


