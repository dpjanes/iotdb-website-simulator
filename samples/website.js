/*
 *  test/website.js
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
const simulator = require("..")
const express = require("iotdb-express")

const path = require("path")

_.promise.make({})
    .then(express.initialize)
    .then(express.listen.http.p(null, 3003))
    .then(simulator.initialize)
    .then(simulator.record)
    .then(simulator.website.p(path.join(__dirname, "data", "website")))
    .then(_.promise.block(sd => {
        console.log("+", "ready", _.values(sd.servers).map(server => server.url));
    }))
    .catch(error => {
        delete error.self;

        console.log("#", error);
    })
