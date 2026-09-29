import test from 'node:test';
import assert from 'node:assert/strict';
import { ECU_DEVICE_ACTIONS, bridgeSupportsAction } from '../src/application/ecu/device-bridge.js';

test('ECU device bridge exposes diagnostic read actions',()=>{
  assert.equal(ECU_DEVICE_ACTIONS.read_dtc.write,false);
  assert.equal(ECU_DEVICE_ACTIONS.read_live_data.write,false);
  assert.equal(ECU_DEVICE_ACTIONS.long_coding_read.write,false);
  assert.equal(ECU_DEVICE_ACTIONS.adaptation_read.write,false);
});

test('ECU device bridge marks write and service operations as confirmed actions',()=>{
  for(const id of ['clear_dtc','long_coding_write','adaptation_write','basic_setting','service_reset','dpf_service_regen']){
    assert.equal(ECU_DEVICE_ACTIONS[id].write,true,id);
  }
  assert.equal(ECU_DEVICE_ACTIONS.dpf_service_regen.hazard,'high');
});


test('bridge claims only explicitly advertised capabilities',()=>{
  assert.equal(bridgeSupportsAction([], 'read_dtc'),false);
  assert.equal(bridgeSupportsAction(['read_dtc'], 'read_dtc'),true);
  assert.equal(bridgeSupportsAction(['read_dtc'], 'long_coding_write'),false);
});
