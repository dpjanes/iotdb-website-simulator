/*
 *  lib/last_request.js
 *
 *  David Janes
 *  IOTDB.org
 *  2017-12-20
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
const express = require("iotdb-express")

const assert = require("assert")

const logger = require("../logger")(__filename);

/**
 *  Get the last request made to the simulator
 */
const last_request = _.promise.make(self => {
    const method = "website";

    assert.ok(self.simulator, `${method}: expected self.simulator`);

    self.last_request = null;
    
    if (self.simulator.requests.length) {
        self.last_request = self.simulator.requests[self.simulator.requests.length - 1];
    }
});

/**
 *  API
 */
exports.last_request = last_request;
