
# lint-blame

[![Version](https://img.shields.io/npm/v/lint-blame.svg)](https://www.npmjs.com/package/lint-blame)
[![Downloads](https://img.shields.io/npm/dt/lint-blame.svg)](https://www.npmjs.com/package/lint-blame)
[![Build Status](https://travis-ci.org/felixfbecker/lint-blame.svg?branch=master)](https://travis-ci.org/felixfbecker/lint-blame)
[![Dependency Status](https://david-dm.org/lint-blame/status.svg)](https://david-dm.org/lint-blame)
![Node Version](https://img.shields.io/node/v/lint-blame.svg)
[![License](https://img.shields.io/npm/l/lint-blame.svg)](https://github.com/felixfbecker/lint-blame/blob/master/LICENSE.txt)

Filters the output of your linter by blaming the lines it complains about.
Allows you to gradually add stricter lint rules to new code only without updating your whole codebase at once.

## Usage

```
Usage: <linter> | blame-lint [options]

Options:
  --help         Show help                                             [boolean]
  --members      A list of { email, name } members that rules should apply for
                                                                         [array]
  --format, -f   The complaint format to parse
                          [required] [choices: "tslint4", "tslint5", "tsconfig"]
  --since        A point in time before which rules do not apply        [string]
  -c, --config   Path to JSON config file         [default: "./lint-blame.json"]
  -v, --version  Show version number                                   [boolean]
```

## Examples

Will only output complaints about lines written after October 3rd 2017.

```
tslint -c tslint.strict.json -p . | lint-blame --format tslint5 --since 2017-10-03
```

### `lint-blame.json`

Will only output complaints about lines written by Jack Bauer and John Doe.

```json
{
  "members": [
    {
      "name": "Jack Bauer",
      "email": "jack@bauer.com"
    },
    {
      "name": "John Doe",
      "email": "john@doe.com"
    }
  ]
}
```
