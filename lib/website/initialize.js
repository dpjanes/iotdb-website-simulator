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
const express = require("iotdb-express")
const errors = require("iotdb-errors")

const assert = require("assert")
const path = require("path")

const xmap = {
    "html": "text/html",
    "txt": "text/plain",
    "json": "application/json",
    "json": "application/ld+json",
    "xml": "application/xml",
    "png": "image/png",
    "jpg": "image/jpg",
    "gif": "image/gif",
    "bin": "application/octet-stream",
}

/**
 *  Serve one page - note that this doesn't have to 
 *  return from a done, as it's basically coming from express
 */
const _page_all = _.promise.make(self => {
    const method = "website.initialize/_serve_rule";

    const xd = self.rule.extensions.find(xd => express.util.accepts(self.request, xd.document_media_type));

    _.promise.make(self)
        .then(_.promise.make(sd => {
            if (!xd) {
                throw new errors.NotAppropriate("don't know how to serve this URL");
            }
        }))
        .then(fs.read.p(xd.path))
        .then(express.send.document)
        .catch(express.send.error(self));
})

/**
 *  Requires: self.rule
 *
 *  Serve this URL. 
 */
const _serve_rule = _.promise.make((self, done) => {
    const method = "website.initialize/_serve_rule";

    assert.ok(self.app, `${method}: expected self.app`);
    assert.ok(self.rule, `${method}: expected self.rule`);

    console.log("-", "rule", self.rule)
    
    _.promise.make(self)
        .then(express.serve.all(self.rule.key, _page_all))
        .then(_.promise.done(done, self))
        .catch(done)
});

/**
 *  Requires: self.paths
 *  Produces: self.rules
 *
 *  This looks at all the paths and groups them together by extension.
 *  self.rules basically will end up with instructions for what routes
 *  to server with express.
 */
const _make_rules = _.promise.make((self, done) => {
    const method = "website.initialize/_make_rules";

    assert.ok(self.paths, `${method}: expected self.paths`);

    const collected = {}

    // first pass - look at files
    self.paths
        .forEach(p => {
            const rooted = p.substring(self.simulatord.website_path.length).replace(/^\/+/, "")
            const dirname = path.dirname(rooted)
            const basename = path.basename(rooted)
            const name = basename.replace(/[.][^.]*$/, "")
            const extension = basename.replace(/^.*[.]/, "")
            const document_media_type = xmap[extension] || "application/octet-stream";

            const parts = [ ]
            if (dirname !== ".") {
                parts.push(dirname)
            }
            if (name !== "index") {
                parts.push(name)
            }

            const key = "/" + parts.join("/")

            let d = collected[key]
            if (!d) {
                collected[key] = d = {
                    key: key,
                    name: name,
                    extensions: [],
                }
            }

            d.extensions.push({
                document_media_type: document_media_type,
                extension: extension,
                path: p,
            })
        })

    const keys = _.keys(collected)
    keys.sort((a, b) => b.length - a.length)

    // second pass - use extensions
    self.rules = keys
        .map(key => collected[key])
        .map(rule => {
            const nrules = [ rule ]

            rule.extensions.forEach(extension => {
                const nrule = _.promise.clone(rule)

                nrule.extensions = [ extension ]
                if (rule.name === "index") {
                    nrule.key = nrule.key.replace(/\/*$/, "") + "/index." + extension.extension
                } else {
                    nrule.key = nrule.key + extension.extension
                }

                nrules.push(nrule)
            })

            return nrules;
        })

    self.rules = _.flatten(self.rules)

    done(null, self)
});

/**
 *  Finds all the files in the "simulatord.website_path",
 *  and coverts them into a website
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
        .then(_make_rules)
        .then(_.promise.series({
            method: _serve_rule,
            inputs: "rules:rule",
        }))
        .then(_.promise.done(done, self))
        .catch(done)
});

/**
 */
exports.initialize = initialize;
