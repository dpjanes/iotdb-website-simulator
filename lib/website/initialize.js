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

const xmap = {
    "text/html": "html",
    "text/plain": "txt",
    "application/json": "json",
    "application/ld+json": "json",
    "application/xml": "xml",
    "image/png": "png",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "application/octet-stream": "bin",
}

/**
 */
const accepts = (request, media_type) => {
    assert.ok(_.is.String(media_type), "accepts: media_type must be a String");

    const accepts = (request.get('accept') || "")
        .split(",")
        .map(item => item.replace(/ *$/, ""))

    return accepts.indexOf(media_type) > -1 ? true : false;
}

/**
 *  Requires: self.rule
 *
 *  Serve this URL. This isn't quite right yet
 */
const _one = _.promise.make((self, done) => {
    const method = "website.initialize/_one";

    assert.ok(self.app, `${method}: expected self.app`);
    assert.ok(self.rule, `${method}: expected self.rule`);

    const serve = pair => _.promise.make(self)
        .then(_.promise.add("path", pair.path))
        .then(fs.read.buffer)
        .then(_.promise.make(sd => {
            self.response.header("Content-Type", pair.media_type)
            self.response.send(sd.document);
        }))
        .catch(error => {
            self.response.status(500);
            self.response.header("Content-Type", "text/plain")
            self.response.send("error:" + _.error.message(error))
        });

    self.app.all(self.rule.key, (request, response) => {
        // find something to serve the request with
        const pair = _.keys(xmap)
            .find(media_type => {
                const extension = xmap[media_type];
                const path = self.rule[extension];

                if (path && accepts(request, media_type)) {
                    return {
                        path: path,
                        media_type: media_type,
                    };
                }
            })

        if (!pair) {
            self.response.status(412);
            self.response.header("Content-Type", "text/plain")
            self.response.send("don't know how to serve this URL");

            return;
        }

        serve(pair)
    })

    console.log("-", "rule", self.rule)
    done(null, self)
});

/**
 *  Requires: self.paths
 *  Produces: self.rules
 *
 *  This looks at all the paths and groups them 
 *  together by extension.
 */
const _collect = _.promise.make((self, done) => {
    const method = "website.initialize/_collect";

    assert.ok(self.paths, `${method}: expected self.paths`);

    const collected = {}

    self.paths
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
        .then(_.promise.make(sd => {
            sd.paths = sd.outputs
                .filter(output => output.exists)
                .map(output => output.path);
        }))
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
