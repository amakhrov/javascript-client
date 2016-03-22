/**
Copyright 2016 Split Software

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
**/

module.exports = {
  enum: {
    ALL: Symbol(),
    SEGMENT: Symbol(),
    WHITELIST: Symbol(),
    EQUAL_TO: Symbol(),
    GREATER_THAN_OR_EQUAL_TO: Symbol(),
    LESS_THAN_OR_EQUAL_TO: Symbol(),
    BETWEEN: Symbol()
  },

  mapper(matcherType /*: string */) /*: Symbol */ {
    switch (matcherType) {
      case 'ALL_KEYS':
        return this.enum.ALL;
      case 'IN_SEGMENT':
        return this.enum.SEGMENT;
      case 'WHITELIST':
        return this.enum.WHITELIST;
      case 'EQUAL_TO':
        return this.enum.EQUAL_TO;
      case 'GREATER_THAN_OR_EQUAL_TO':
        return this.enum.GREATER_THAN_OR_EQUAL_TO;
      case 'LESS_THAN_OR_EQUAL_TO':
        return this.enum.LESS_THAN_OR_EQUAL_TO;
      case 'BETWEEN':
        return this.enum.BETWEEN;
      default:
        throw new Error('Invalid matcher type provided');
    }
  }
};
