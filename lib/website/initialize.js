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
const path = require("path")

/**
 */
const _one = _.promise.make((self, done) => {
    const method = "website.initialize/_one";

    assert.ok(self.rule, `${method}: expected self.rule`);

    console.log("-", "rule", self.rule)
    done(null, self)
});

/**
 */
const _collect = _.promise.make((self, done) => {
    const method = "website.initialize/_collect";

    assert.ok(self.paths, `${method}: expected self.paths`);

    const collected = {}

    self.outputs
        .filter(output => output.exists)
        .map(output => output.path)
        .forEach(p => {
            const rooted = p.substring(self.simulatord.website_path.length).replace(/^\/+/, "")
            const dirname = path.dirname(rooted)
            const basename = path.basename(rooted)
            const name = basename.replace(/[.][^.]*$/, "")
            const extension = basename.replace(/^.*[.]/, "")

            const parts = [ ]
            if (dirname !== ".") {
                parts.push(dirname)
            }
            if (name !== "index") {
                parts.push(name)
            }

            const key = "/" + parts.join("/")

            const d = collected[key]
            if (d) {
                d.extensions[extension] = p;
            } else {
                collected[key] = {
                    key: key,
                    rooted: rooted,
                    basename: basename,
                    name: name,
                    extensions: {
                        [ extension ]: p,
                    }
                }
            }
        })

    const keys = _.keys(collected)
    keys.sort((a, b) => b.length - a.length)

    self.rules = keys.map(key => collected[key])

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
        .then(fs.all(fs.is.file))
        .then(_collect)
        .then(_.promise.series({
            method: _one,
            inputs: "rules:rule",
        }))
        .then(_.promise.done(done, self))
        .catch(done)
});

/**
 */
exports.initialize = initialize;
