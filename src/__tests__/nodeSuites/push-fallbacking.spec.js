/**
 * Validate the handling of OCCUPANCY and CONTROL events
 */

import splitChangesMock1 from '../mocks/splitchanges.real.withSegments.json'; // since: -1, till: 1457552620999 (for initial fetch)
import splitChangesMock2 from '../mocks/splitchanges.real.updateWithSegments.json'; // since: 1457552620999, till: 1457552649999 (for SPLIT_UPDATE event)
import splitChangesMock3 from '../mocks/splitchanges.real.updateWithoutSegments.json'; // since: 1457552649999, till: 1457552669999 (for second polling fetch)

import occupancy0ControlPriMessage from '../mocks/message.OCCUPANCY.0.control_pri.1586987434550.json';
import occupancy1ControlPriMessage from '../mocks/message.OCCUPANCY.1.control_pri.1586987434450.json';
import occupancy1ControlSecMessage from '../mocks/message.OCCUPANCY.1.control_sec.1586987434451.json';
import occupancy2ControlPriMessage from '../mocks/message.OCCUPANCY.2.control_pri.1586987434650.json';

import streamingPausedControlPriMessage from '../mocks/message.CONTROL.STREAMING_PAUSED.control_pri.1586987434750.json';
import streamingResumedControlPriMessage from '../mocks/message.CONTROL.STREAMING_RESUMED.control_pri.1586987434850.json';
import streamingDisabledControlPriMessage from '../mocks/message.CONTROL.STREAMING_DISABLED.control_pri.1586987434950.json';

import splitUpdateMessage from '../mocks/message.SPLIT_UPDATE.1457552649999.json';
import segmentUpdateMessage1 from '../mocks/message.SEGMENT_UPDATE.1457552640000.json';
import segmentUpdateMessage2 from '../mocks/message.SEGMENT_UPDATE.1457552650000.json';

import authPushEnabled from '../mocks/auth.pushEnabled.node.json';

import { nearlyEqual, mockSegmentChanges } from '../testUtils';

import EventSourceMock, { setMockListener } from '../../sync/__tests__/mocks/eventSourceMock';
import { __setEventSource } from '../../services/getEventSource/node';

import { SplitFactory } from '../..';
import SettingsFactory from '../../utils/settings';

const key = 'nicolas@split.io';

const baseUrls = {
  sdk: 'https://sdk.push-synchronization/api',
  events: 'https://events.push-synchronization/api',
  auth: 'https://auth.push-synchronization/api'
};
const config = {
  core: {
    authorizationKey: '<fake-token-push-1>'
  },
  scheduler: {
    featuresRefreshRate: 0.2,
    segmentsRefreshRate: 0.25,
    metricsRefreshRate: 3000,
    impressionsRefreshRate: 3000
  },
  urls: baseUrls,
  streamingEnabled: true,
  // debug: true,
};
const settings = SettingsFactory(config);

const MILLIS_SSE_OPEN = 100;
const MILLIS_STREAMING_DOWN_OCCUPANCY = MILLIS_SSE_OPEN + 100;
const MILLIS_SPLIT_UPDATE_EVENT_DURING_POLLING = MILLIS_STREAMING_DOWN_OCCUPANCY + 100;
const MILLIS_STREAMING_UP_OCCUPANCY = MILLIS_STREAMING_DOWN_OCCUPANCY + settings.scheduler.featuresRefreshRate + 100;
const MILLIS_SPLIT_UPDATE_EVENT_DURING_PUSH = MILLIS_STREAMING_UP_OCCUPANCY + 100;

const MILLIS_STREAMING_PAUSED_CONTROL = MILLIS_SPLIT_UPDATE_EVENT_DURING_PUSH + 100;
const MILLIS_SEGMENT_UPDATE_EVENT_DURING_POLLING = MILLIS_STREAMING_PAUSED_CONTROL + 100;
const MILLIS_STREAMING_RESUMED_CONTROL = MILLIS_STREAMING_PAUSED_CONTROL + settings.scheduler.featuresRefreshRate + 100;
const MILLIS_SEGMENT_UPDATE_EVENT_DURING_PUSH = MILLIS_STREAMING_RESUMED_CONTROL + 100;
const MILLIS_STREAMING_DISABLED_CONTROL = MILLIS_SEGMENT_UPDATE_EVENT_DURING_PUSH + 100;
const MILLIS_DESTROY = MILLIS_STREAMING_DISABLED_CONTROL + settings.scheduler.featuresRefreshRate * 2 + 100;

/**
 * Sequence of calls:
 *  0.0 secs: initial SyncAll (/splitChanges, /segmentChanges/*), auth, SSE connection
 *  0.1 secs: SSE connection opened -> syncAll (/splitChanges, /segmentChanges/*)
 *  0.2 secs: Streaming down (OCCUPANCY event) -> fetch due to fallback to polling (/splitChanges, /segmentChanges/*)
 *  0.3 secs: SPLIT_UPDATE event ignored
 *  0.4 secs: periodic fetch due to polling (/splitChanges)
 *  0.45 secs: periodic fetch due to polling (/segmentChanges/*)
 *  0.5 secs: Streaming up (OCCUPANCY event) -> syncAll (/splitChanges, /segmentChanges/*)
 *  0.6 secs: SPLIT_UPDATE event -> /splitChanges
 *  0.7 secs: Streaming down (CONTROL event) -> fetch due to fallback to polling (/splitChanges, /segmentChanges/*)
 *  0.8 secs: SEGMENT_UPDATE event ignored
 *  0.9 secs: periodic fetch due to polling (/splitChanges)
 *  0.95 secs: periodic fetch due to polling (/segmentChanges/*)
 *  1.0 secs: Streaming up (CONTROL event) -> syncAll (/splitChanges, /segmentChanges/*)
 *  1.1 secs: SEGMENT_UPDATE event -> /segmentChanges/*
 *  1.2 secs: Streaming down (CONTROL event) -> fetch due to fallback to polling (/splitChanges, /segmentChanges/*)
 *  1.4 secs: periodic fetch due to polling (/splitChanges)
 *  1.45 secs: periodic fetch due to polling (/segmentChanges/*)
 *  1.6 secs: periodic fetch due to polling (/splitChanges, /segmentChanges/*)
 *  1.7 secs: periodic fetch due to polling (/segmentChanges/*)
 *  1.7 secs: destroy client
 */
export function testFallbacking(fetchMock, assert) {
  assert.plan(13);
  fetchMock.reset();
  __setEventSource(EventSourceMock);

  let start, splitio, client;

  // mock SSE open and message events
  setMockListener(function (eventSourceInstance) {

    const expectedSSEurl = `${settings.url('/sse')}?channels=NzM2MDI5Mzc0_NDEzMjQ1MzA0Nw%3D%3D_segments,NzM2MDI5Mzc0_NDEzMjQ1MzA0Nw%3D%3D_splits,%5B%3Foccupancy%3Dmetrics.publishers%5Dcontrol_pri,%5B%3Foccupancy%3Dmetrics.publishers%5Dcontrol_sec&accessToken=${authPushEnabled.token}&v=1.1&heartbeats=true`;
    assert.equals(eventSourceInstance.url, expectedSSEurl, 'EventSource URL is the expected');

    setTimeout(() => {
      eventSourceInstance.emitOpen();
      eventSourceInstance.emitMessage(occupancy1ControlPriMessage);
      eventSourceInstance.emitMessage(occupancy1ControlSecMessage);
    }, MILLIS_SSE_OPEN); // open SSE connection after 0.1 seconds

    setTimeout(() => {
      eventSourceInstance.emitMessage(occupancy0ControlPriMessage);
    }, MILLIS_STREAMING_DOWN_OCCUPANCY); // send an OCCUPANCY event for switching to polling

    setTimeout(() => {
      eventSourceInstance.emitMessage(splitUpdateMessage);
    }, MILLIS_SPLIT_UPDATE_EVENT_DURING_POLLING); // send a SPLIT_UPDATE event while polling, to check that we are ignoring it

    setTimeout(() => {
      eventSourceInstance.emitMessage(occupancy2ControlPriMessage);
    }, MILLIS_STREAMING_UP_OCCUPANCY); // send a OCCUPANCY event for switching to push

    setTimeout(() => {
      assert.equal(client.getTreatment(key, 'real_split'), 'on', 'evaluation of initial Split');
      client.once(client.Event.SDK_UPDATE, () => {
        assert.equal(client.getTreatment(key, 'real_split'), 'off', 'evaluation of updated Split');
      });
      eventSourceInstance.emitMessage(splitUpdateMessage);
    }, MILLIS_SPLIT_UPDATE_EVENT_DURING_PUSH); // send a SPLIT_UPDATE event when push resumed, to check that we are handling it

    setTimeout(() => {
      eventSourceInstance.emitMessage(streamingPausedControlPriMessage);
    }, MILLIS_STREAMING_PAUSED_CONTROL); // send a CONTROL event for switching to polling

    setTimeout(() => {
      eventSourceInstance.emitMessage(segmentUpdateMessage1);
    }, MILLIS_SEGMENT_UPDATE_EVENT_DURING_POLLING); // send a SEGMENT_UPDATE event while polling, to check that we are ignoring it

    setTimeout(() => {
      eventSourceInstance.emitMessage(streamingResumedControlPriMessage);
    }, MILLIS_STREAMING_RESUMED_CONTROL); // send a CONTROL event for switching to push

    setTimeout(() => {
      assert.equal(client.getTreatment(key, 'real_split'), 'off', 'evaluation with initial segment');
      client.once(client.Event.SDK_UPDATE, () => {
        assert.equal(client.getTreatment(key, 'real_split'), 'on', 'evaluation with updated segment');
      });
      eventSourceInstance.emitMessage(segmentUpdateMessage2);
    }, MILLIS_SEGMENT_UPDATE_EVENT_DURING_PUSH); // send a SEGMENT_UPDATE event when push resumed, to check that we are handling it

    setTimeout(() => {
      eventSourceInstance.emitMessage(streamingDisabledControlPriMessage);
      assert.equal(eventSourceInstance.readyState, EventSourceMock.CLOSED, 'EventSource connection closed on STREAMING_DISABLED CONTROL event');
    }, MILLIS_STREAMING_DISABLED_CONTROL); // send a CONTROL event for disabling push and switching to polling

    setTimeout(() => {
      client.destroy().then(() => {
        assert.pass('client destroyed');
      });
    }, MILLIS_DESTROY); // destroy client after 0.6 seconds
  });

  fetchMock.getOnce(settings.url('/auth'), function (url, opts) {
    if (!opts.headers['Authorization']) assert.fail('`/auth` request must include `Authorization` header');
    assert.pass('auth success');
    return { status: 200, body: authPushEnabled };
  });

  // initial split and segment sync
  fetchMock.getOnce(settings.url('/splitChanges?since=-1'), { status: 200, body: splitChangesMock1 });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=-1'), { status: 200, body: { since: -1, till: 1457552620999, name: 'employees', added: [key], removed: [] } });
  // extra retry due to double request (greedy fetch until since === till)
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552620999'), { status: 200, body: { since: 1457552620999, till: 1457552620999, name: 'employees', added: [], removed: [] } });

  // split and segment sync after SSE opened
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552620999'), { status: 200, body: { splits: [], since: 1457552620999, till: 1457552620999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552620999'), { status: 200, body: { since: 1457552620999, till: 1457552620999, name: 'employees', added: [], removed: [] } });

  // fetches due to first fallback to polling
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552620999'), { status: 200, body: { splits: [], since: 1457552620999, till: 1457552620999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552620999'), { status: 200, body: { since: 1457552620999, till: 1457552620999, name: 'employees', added: [], removed: [] } });
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552620999'), function () {
    const lapse = Date.now() - start;
    assert.true(nearlyEqual(lapse, MILLIS_STREAMING_DOWN_OCCUPANCY + settings.scheduler.featuresRefreshRate), 'fetch due to first fallback to polling');
    return { status: 200, body: { splits: [], since: 1457552620999, till: 1457552620999 } };
  });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552620999'), { status: 200, body: { since: 1457552620999, till: 1457552620999, name: 'employees', added: [], removed: [] } });

  // split and segment sync due to streaming up (OCCUPANCY event)
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552620999'), { status: 200, body: { splits: [], since: 1457552620999, till: 1457552620999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552620999'), { status: 200, body: { since: 1457552620999, till: 1457552621999, name: 'employees', added: ['other_key'], removed: [] } });
  // extra retry due to double request (greedy fetch until since === till)
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552621999'), { status: 200, body: { since: 1457552621999, till: 1457552621999, name: 'employees', added: [], removed: [] } });

  // fetch due to SPLIT_UPDATE event
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552620999'), function () {
    const lapse = Date.now() - start;
    assert.true(nearlyEqual(lapse, MILLIS_SPLIT_UPDATE_EVENT_DURING_PUSH), 'sync due to SPLIT_UPDATE event');
    return { status: 200, body: splitChangesMock2 };
  });

  // fetches due to second fallback to polling
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552649999'), { status: 200, body: { splits: [], since: 1457552649999, till: 1457552649999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552621999'), { status: 200, body: { since: 1457552621999, till: 1457552621999, name: 'employees', added: [], removed: [] } });
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552649999'), function () {
    const lapse = Date.now() - start;
    assert.true(nearlyEqual(lapse, MILLIS_STREAMING_PAUSED_CONTROL + settings.scheduler.featuresRefreshRate), 'fetch due to second fallback to polling');
    return { status: 200, body: { splits: [], since: 1457552649999, till: 1457552649999 } };
  });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552621999'), { status: 200, body: { since: 1457552621999, till: 1457552621999, name: 'employees', added: [], removed: [] } });

  // split and segment sync due to streaming up (CONTROL event)
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552649999'), { status: 200, body: { splits: [], since: 1457552649999, till: 1457552649999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552621999'), { status: 200, body: { since: 1457552621999, till: 1457552621999, name: 'employees', added: [], removed: [] } });

  // fetch due to SEGMENT_UPDATE event
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552621999'), { status: 200, body: { since: 1457552621999, till: 1457552650000, name: 'employees', added: [], removed: [key] } });
  // extra retry (fetch until since === till)
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552650000'), { status: 200, body: { since: 1457552650000, till: 1457552650000, name: 'employees', added: [], removed: [] } });

  // fetches due to third fallback to polling
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552649999'), { status: 200, body: { splits: [], since: 1457552649999, till: 1457552649999 } });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552650000'), { status: 200, body: { since: 1457552650000, till: 1457552650000, name: 'employees', added: [], removed: [] } });
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552649999'), function () {
    const lapse = Date.now() - start;
    assert.true(nearlyEqual(lapse, MILLIS_STREAMING_DISABLED_CONTROL + settings.scheduler.featuresRefreshRate), 'fetch due to third fallback to polling');
    return { status: 200, body: splitChangesMock3 };
  });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552650000'), { status: 200, body: { since: 1457552650000, till: 1457552650000, name: 'employees', added: [], removed: [] } });
  fetchMock.getOnce(settings.url('/splitChanges?since=1457552669999'), function () {
    const lapse = Date.now() - start;
    assert.true(nearlyEqual(lapse, MILLIS_STREAMING_DISABLED_CONTROL + settings.scheduler.featuresRefreshRate * 2), 'fetch due to third fallback to polling');
    return { status: 200, body: { splits: [], since: 1457552669999, till: 1457552669999 } };
  });
  fetchMock.getOnce(settings.url('/segmentChanges/employees?since=1457552650000'), { status: 200, body: { since: 1457552650000, till: 1457552650000, name: 'employees', added: [], removed: [] } });

  mockSegmentChanges(fetchMock, new RegExp(`${settings.url('/segmentChanges')}/(splitters|developers)`), [key]);

  fetchMock.get(new RegExp('.*'), function (url) {
    assert.fail('unexpected GET request with url: ' + url);
  });

  fetchMock.post('*', 200);

  start = Date.now();
  splitio = SplitFactory(config);
  client = splitio.client();

}