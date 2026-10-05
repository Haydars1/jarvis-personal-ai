// ECU Tuning UI Module
// Upload, vehicle detection, proposal review, download tuned file

export function initEcuTuningUI() {
  const html = `
    <div id="ecu-tuning-panel" style="padding:20px; background:#f5f5f5; border-radius:8px; margin:10px 0;">
      <h2>🔧 ECU Tuning Studio</h2>
      
      <!-- Upload Section -->
      <div id="ecu-upload-section" style="margin-bottom:20px;">
        <div style="border:2px dashed #ccc; padding:20px; border-radius:8px; text-align:center; cursor:pointer;" id="ecu-drop-zone">
          <p>📁 Drag ECU file here or <span style="color:blue; cursor:pointer;">click to upload</span></p>
          <input type="file" id="ecu-file-input" accept=".hex,.bin" style="display:none;">
        </div>
      </div>
      
      <!-- Detection Results -->
      <div id="ecu-detection-results" style="display:none; margin-bottom:20px;">
        <div style="background:white; padding:15px; border-radius:8px;">
          <h3>🚗 Vehicle Detection</h3>
          <div id="ecu-vehicles-list"></div>
          <p id="ecu-detection-status"></p>
        </div>
      </div>
      
      <!-- Proposals Review -->
      <div id="ecu-proposals-section" style="display:none; margin-bottom:20px;">
        <div style="background:white; padding:15px; border-radius:8px;">
          <h3>✅ Tuning Proposals</h3>
          <p style="color:#666; font-size:0.9em;">Select which tuning modifications to apply:</p>
          <div id="ecu-proposals-list"></div>
        </div>
      </div>
      
      <!-- Confirmation -->
      <div id="ecu-confirmation-section" style="display:none; margin-bottom:20px;">
        <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; border-radius:4px;">
          <p style="margin:0; font-weight:bold;">⚠️ Manual Review Required</p>
          <p style="margin:5px 0 0 0; font-size:0.9em;">
            You are about to apply tuning modifications. This is your responsibility.<br>
            Please review the selected changes and confirm.
          </p>
          <div style="margin-top:10px;">
            <button id="ecu-confirm-btn" style="background:#28a745; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; margin-right:10px;">
              ✓ Confirm & Generate Tuned File
            </button>
            <button id="ecu-cancel-btn" style="background:#dc3545; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">
              ✗ Cancel
            </button>
          </div>
        </div>
      </div>
      
      <!-- Output -->
      <div id="ecu-output-section" style="display:none; margin-bottom:20px;">
        <div style="background:#d4edda; border-left:4px solid #28a745; padding:15px; border-radius:4px;">
          <p style="margin:0; font-weight:bold;">✅ Tuning Complete</p>
          <div id="ecu-output-info"></div>
          <button id="ecu-download-btn" style="background:#007bff; color:white; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; margin-top:10px;">
            📥 Download Tuned File
          </button>
        </div>
      </div>
      
      <!-- Status -->
      <div id="ecu-status-msg" style="margin-top:20px; padding:10px; border-radius:4px; display:none;"></div>
    </div>
  `;
  
  return html;
}

export function setupEcuTuningHandlers(sendMessage) {
  const dropZone = document.getElementById('ecu-drop-zone');
  const fileInput = document.getElementById('ecu-file-input');
  const statusMsg = document.getElementById('ecu-status-msg');
  
  let currentUploadId = null;
  let currentProposals = [];
  
  function showStatus(msg, type = 'info') {
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
    statusMsg.style.background = type === 'error' ? '#f8d7da' : type === 'success' ? '#d4edda' : '#d1ecf1';
    statusMsg.style.color = type === 'error' ? '#721c24' : type === 'success' ? '#155724' : '#0c5460';
  }
  
  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = '#e0e0e0';
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '';
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
  
  async function handleFileSelect(file) {
    showStatus(`📂 Uploading ${file.name}...`, 'info');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const formData = new FormData();
      formData.append('file', new Blob([arrayBuffer]), file.name);
      
      const response = await fetch('/api/ecu/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!data.ok) {
        showStatus(`Error: ${data.error}`, 'error');
        return;
      }
      
      currentUploadId = data.uploadId;
      showDetectionResults(data.detections, data.format);
    } catch (e) {
      showStatus(`Upload error: ${e.message}`, 'error');
    }
  }
  
  function showDetectionResults(detections, format) {
    const resultDiv = document.getElementById('ecu-detection-results');
    const vehiclesList = document.getElementById('ecu-vehicles-list');
    const statusDiv = document.getElementById('ecu-detection-status');
    
    vehiclesList.innerHTML = '';
    
    if (detections.length === 0) {
      statusDiv.innerHTML = '⚠️ No vehicle detected. Manual selection:';
      const manualSelect = document.createElement('select');
      manualSelect.id = 'ecu-manual-vehicle';
      manualSelect.innerHTML = `
        <option value="">-- Select Vehicle --</option>
        <option value="bosch_me7">Bosch ME7</option>
        <option value="siemens_mse7">Siemens MSE7</option>
      `;
      statusDiv.appendChild(manualSelect);
      
      manualSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          showProposals(e.target.value);
        }
      });
    } else {
      detections.forEach(det => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px; background:#f9f9f9; margin:5px 0; border-radius:4px; cursor:pointer; border-left:4px solid #007bff;';
        div.innerHTML = `
          <strong>${det.name}</strong> (${det.confidence.toFixed(0)}% match)<br>
          <small>Size: ${det.fileSize} bytes | Expected: ${det.expectedSize} bytes</small>
        `;
        div.addEventListener('click', () => showProposals(det.vehicleId));
        vehiclesList.appendChild(div);
      });
      statusDiv.innerHTML = '🎯 Click a vehicle to see tuning options';
    }
    
    resultDiv.style.display = 'block';
    showStatus(`✓ File uploaded (${format})`, 'success');
  }
  
  function showProposals(vehicleId) {
    const proposalDiv = document.getElementById('ecu-proposals-section');
    const proposalsList = document.getElementById('ecu-proposals-list');
    
    proposalsList.innerHTML = '';
    
    // Mock proposals — replace with actual backend call
    currentProposals = [
      {
        id: 'stage1',
        name: 'Stage 1 Tuning',
        description: 'Boost pressure +0.2 bar, fuel timing +2°',
        risk: 'medium'
      },
      {
        id: 'egr_off',
        name: 'EGR Disable',
        description: 'Disable EGR system',
        risk: 'low'
      }
    ];
    
    currentProposals.forEach(prop => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block; padding:10px; background:#f9f9f9; margin:5px 0; border-radius:4px; cursor:pointer;';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = prop.id;
      checkbox.style.marginRight = '10px';
      
      const text = document.createElement('span');
      text.innerHTML = `
        <strong>${prop.name}</strong> [${prop.risk}]<br>
        <small>${prop.description}</small>
      `;
      
      label.appendChild(checkbox);
      label.appendChild(text);
      proposalsList.appendChild(label);
    });
    
    proposalDiv.style.display = 'block';
    
    // Show confirmation button
    const confirmSection = document.getElementById('ecu-confirmation-section');
    confirmSection.style.display = 'block';
  }
  
  // Confirm button
  document.getElementById('ecu-confirm-btn').addEventListener('click', async () => {
    const selected = Array.from(document.querySelectorAll('#ecu-proposals-list input[type="checkbox"]:checked')).map(x => x.value);
    
    if (selected.length === 0) {
      showStatus('Select at least one tuning option', 'error');
      return;
    }
    
    showStatus('🔄 Generating tuned file...', 'info');
    
    try {
      const response = await fetch('/api/ecu/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: currentUploadId,
          selectedProposals: selected
        })
      });
      
      const data = await response.json();
      if (!data.ok) {
        showStatus(`Error: ${data.error}`, 'error');
        return;
      }
      
      showTunedOutput(data);
    } catch (e) {
      showStatus(`Generation error: ${e.message}`, 'error');
    }
  });
  
  // Cancel button
  document.getElementById('ecu-cancel-btn').addEventListener('click', () => {
    location.reload();
  });
  
  function showTunedOutput(data) {
    const outputSection = document.getElementById('ecu-output-section');
    const outputInfo = document.getElementById('ecu-output-info');
    
    outputInfo.innerHTML = `
      <p style="margin:10px 0;">Applied: <strong>${data.appliedPatches.length}</strong> patches</p>
      <p style="margin:0;">File size: <strong>${data.size}</strong> bytes | Hash: <code style="font-size:0.8em;">${data.hash.slice(0, 16)}...</code></p>
    `;
    
    outputSection.style.display = 'block';
    
    document.getElementById('ecu-download-btn').addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = `/api/ecu/download?tunedId=${data.tunedId}`;
      link.download = `tuned_${data.uploadId}.bin`;
      link.click();
    });
    
    showStatus('✅ Tuning complete! Ready to download.', 'success');
  }
}
