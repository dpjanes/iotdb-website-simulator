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

const logger = require("../logger")(__filename);

const xmap = {
    "html": "text/html",
    "txt": "text/plain",
    "json": "application/json",
    "jsonld": "application/ld+json",
    "xml": "application/xml",
    "png": "image/png",
    "jpg": "image/jpg",
    "gif": "image/gif",
    "bin": "application/octet-stream",
    "consensas": "application/consensas.ledger",
}

const methods = [
    ".GET",
    ".PUT",
    ".PATCH",
    ".POST",
    ".DELETE",
    ".HEAD",
]

const scrub_method = p => {
    for (let mi = 0; mi < methods.length; mi++) {
        const method = methods[mi];
        if (p.endsWith(method)) {
            return p.substring(0, p.length - method.length)
        }
    }

    return p
}

/**
 *  Serve one page - note that this doesn't have to 
 *  return from a done, as it's basically coming from express
 *
 *  We try to find files ending in ".GET", ".POST" etc
 *  which makes this code a little messier than optimal
 */
const _page_all = rule => _.promise.make(self => {
    const method = "website/_serve_rule";

    const xd = rule.extensions.find(xd => express.util.accepts(self.request, xd.document_media_type));

    _.promise.make(self)
        .then(_.promise.make(sd => {
            if (sd.simulator.requests.length) {
                sd.simulator.requests[sd.simulator.requests.length - 1].params = sd.request.params;
            }
        }))
        .then(_.promise.make(sd => {
            if (!xd) {
                throw new errors.NotAppropriate("don't know how to serve this URL")
            } 

            sd.path = xd.path;
        }))
        .then(fs.read)
        .then(_.promise.add(sd => ({
            fs$otherwise_document: sd.document,
            otherwise_media_type: sd.document_media_type || xd.document_media_type,
            path: xd.path + "." + sd.request.method,
        })))
        .then(fs.read)
        .then(_.promise.add(sd => ({
            document_media_type: sd.otherwise_media_type,
        })))
        .then(express.send.document)
        .catch(express.send.error(self));
})

/**
 *  Requires: self.rule
 *
 *  Serve this URL. 
 */
const _serve_rule = _.promise.make((self, done) => {
    const method = "website/_serve_rule";

    assert.ok(self.app, `${method}: expected self.app`);
    assert.ok(self.rule, `${method}: expected self.rule`);

    if (self.verbose) {
        logger.info({
            rule: self.rule,
        }, "server path");
    }
    
    _.promise.make(self)
        .then(express.serve.all(self.rule.key, _page_all(self.rule)))
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
    const method = "website/_make_rules";

    assert.ok(self.paths, `${method}: expected self.paths`);

    const collected = {}

    // first pass - look at files
    self.paths
        .forEach(p => {
            const rooted = p.substring(self.website_root.length).replace(/^\/+/, "")
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

            const key = ("/" + parts.join("/")).replace(/@/g, ":")

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
    // keys.sort((a, b) => b.length - a.length)

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
                    nrule.key = nrule.key + "." + extension.extension
                }

                nrules.push(nrule)
            })

            return nrules;
        })

    self.rules = _.flatten(self.rules)

    logger.info({
        routes: self.rules.map(rule => rule.key)
    }, "routes")

    done(null, self)
});

/**
 *  Finds all the files in `path` and coverts them into a website
 */
const website = _.promise.make((self, done) => {
    const method = "website";

    assert.ok(self.app, `${method}: expected self.app`);
    assert.ok(_.is.String(self.path), `${method}: expected self.path`);

    _.promise.make(self)
        .then(_.promise.add({
            website_root: self.path,
            fs$sorter: (a, b) => {
                // colons are deprioritized
                const a_colon = a.startsWith(":") ? 1 : 0;
                const b_colon = b.startsWith(":") ? 1 : 0;

                if (a_colon < b_colon) {
                    return -1;
                } else if (b_colon < a_colon) {
                    return 1;
                } else if (a < b) {
                    return 1;
                } else if (b < a) {
                    return -1;
                } else {
                    return 0;
                }
            }
        }))
        .then(fs.list.depth_first)
        .then(fs.all(fs.is.file))
        .then(_.promise.make(sd => {
            sd.paths = _.uniq(sd.outputs
                .filter(output => output.exists)
                .map(output => output.path)
                .map(p => scrub_method(p)))
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
 *  Parameterized
 */
const website_p = path => _.promise.make((self, done) => {
    _.promise.make(self)
        .then(_.promise.add("path", path || self.path))
        .then(website)
        .then(express.take_self)
        .then(_.promise.done(done, self))
        .catch(done)
})

/**
 *  API
 */
exports.website = website;
exports.website.p = website_p;
