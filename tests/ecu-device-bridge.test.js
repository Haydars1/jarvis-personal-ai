import test from 'node:test';
import assert from 'node:assert/strict';
import { ECU_DEVICE_ACTIONS, bridgeSupportsAction, parseEcuDeviceIntent } from '../src/application/ecu/device-bridge.js';

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


test('ECU chat maps safe diagnostic phrases to device actions',()=>{
  assert.equal(parseEcuDeviceIntent('DTC arıza kodlarını oku'),'read_dtc');
  assert.equal(parseEcuDeviceIntent('canlı veriyi göster'),'read_live_data');
  assert.equal(parseEcuDeviceIntent('long coding oku'),'long_coding_read');
  assert.equal(parseEcuDeviceIntent('adaptasyon değerlerini göster'),'adaptation_read');
});

test('ECU chat identifies write/service actions for confirmation gating',()=>{
  assert.equal(parseEcuDeviceIntent('DTC kodlarını temizle'),'clear_dtc');
  assert.equal(parseEcuDeviceIntent('servis reset yap'),'service_reset');
  assert.equal(parseEcuDeviceIntent('DPF servis rejenerasyonu başlat'),'dpf_service_regen');
});
