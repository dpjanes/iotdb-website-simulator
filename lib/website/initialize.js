/*
 *  lib/website.js
 *
 *  David Janes
 *  IOTDB.org
 *  2017-12-18
 *
 *  Copyright [2013-2018] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

const _ = require("iotdb-helpers")
const fs = require("iotdb-fs")

const assert = require("assert")

/**
 */
const _one = _.promise.make((self, done) => {
    const method = "website.initialize/_one";

    assert.ok(self.path, `${method}: expected self.path`);

    console.log(self.path)
    done(null, self)
});

/**
 */
const initialize = _.promise.make((self, done) => {
    const method = "website.initialize";

    assert.ok(self.app, `${method}: expected self.app`);
    assert.ok(self.simulatord, `${method}: expected self.simulatord`);
    assert.ok(self.simulatord.website_path, `${method}: expected self.simulatord.website_path`);

    _.promise.make(self)
        .then(_.promise.add("path", self.simulatord.website_path))
        .then(fs.list.recursive)
        .then(_.promise.series({
            method: _one,
            inputs: "paths:path",
        }))
        .then(_.promise.done(done, self))
        .catch(done)
});

/**
 */
exports.initialize = initialize;
