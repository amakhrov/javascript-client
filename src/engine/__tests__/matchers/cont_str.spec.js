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
import tape from 'tape-catch';
import { matcherTypes } from '../../matchers/types';
import matcherFactory from '../../matchers';

tape('MATCHER CONTAINS_STRING / should return true ONLY when the value is contained in ["roni", "bad", "ar"]', function (assert) {

  let matcher = matcherFactory({
    negate: false,
    type: matcherTypes.CONTAINS_STRING,
    value: ['roni', 'bad', 'ar']
  });

  assert.true(matcher('pepperoni'), 'pepperoni contain ["roni", "bad", "ar"]');
  assert.true(matcher('badminton'), 'badminton contain ["roni", "bad", "ar"]');
  assert.true(matcher('market'),    'market contain ["roni", "bad", "ar"]');
  assert.false(matcher('violin'),   'violin does not contain ["roni", "bad", "ar"]');
  assert.false(matcher('manager'),  'manager does not contain ["roni", "bad", "ar"]');
  assert.end();

});