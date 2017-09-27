(function() {
  const DEBUGGING = true;
  function log() {
    if (DEBUGGING) console.log(arguments[0], arguments[1] || '', arguments[2] || '', arguments[3] || '', arguments[4] || '');
  };
  
  // Sort instance list by score (easiest first)
  function sortInstancesByScore(a,b) {
    if (a.level > b.level) return -1;    
    if (a.level < b.level) return 1;
    if (a.score > b.score) return -1;
    if (a.score < b.score) return 1;
    return 0;
  }

  function sortCharactersByAvailability(a,b) {
    if (a.instances.length < b.instances.length) return -1;    
    if (a.instances.length > b.instances.length) return 1;
    return 0;
  }

  const instancePoints = [
    // Azsuna
    { instance: 'Ojo',           points: 70 },
    { instance: 'Celadoras',     points: 20 },
    // Valshara
    { instance: 'Arboleda',      points: 90 },
    { instance: 'Torreón',       points: 10 },
    // Monte Alto
    { instance: 'Neltharion',    points: 80 },
    // Tormenheim
    { instance: 'Valor',         points: 50 },
    { instance: 'Fauce',         points: 60 },
    // Suramar
    { instance: 'Arco',          points: 30 },
    { instance: 'Corte',         points: 40 },
    // Costa abrupta
    { instance: 'Catedral',      points: 00 },
    // Argus
    { instance: 'Triunvirato',   points: 00 },
    // Otras
    { instance: 'Karazhan sup.', points: 00 },
    { instance: 'Karazhan inf.', points: 00 },
  ];

  var tankCount = 0;
  var healCount = 0;
  var DPSCount = 0;

  const maxTankCount = 1;
  const maxHealCount = 1;
  const maxDPSCount = 3;

  var uploadedData;
  var availableInstances = [];
  var characterAssociations = [];

  const mountPoint = document.querySelector('.MRC');
  mountPoint.id = 'mythic-calculator';
  mountPoint.name = 'mythic-calculator';
  
  // Set initial UI
  function setUI() {
    var filePickerInput = document.createElement('input');
    filePickerInput.type = 'file';
    filePickerInput.id = 'file-picker';
    filePickerInput.name = 'file-picker';
    filePickerInput.style = 'display: none';
    filePickerInput.addEventListener('change', handleFileChange);

    var filePickerLabel = document.createElement('span');
    filePickerLabel.innerText = 'Upload file';

    var filePickerWrapper = document.createElement('label');
    filePickerWrapper.classList.add('mc-button');
    filePickerWrapper.classList.add('mc-button-comb');
    filePickerWrapper.classList.add('mc-clickable');
    filePickerWrapper.classList.add('mc-button-raised');
    filePickerWrapper.setAttribute('mc-action', 'upload');

    filePickerWrapper.appendChild(filePickerInput);
    filePickerWrapper.appendChild(filePickerLabel);

    mountPoint.appendChild(filePickerWrapper);
  }

  // Upload and read a JSON file
  function handleFileChange(e) {
    e.preventDefault();
  
    const reader = new FileReader();
    const file = e.target.files[0];
  
    var state = {
      loading: false,
      progress: 0,
    };
  
    reader.onloadend = () => {
      uploadedData = JSON.parse(reader.result);
      getAvailableInstances();
    };
  
    if (file) {
      reader.readAsText(file);
    }
  }

  // Get all keystones and sort them by score
  function getAvailableInstances() {
    const playableInstances = [];
    const forbiddenInstances = [];
    availableInstances = [];

    // Add playable instances
    uploadedData.forEach((p) => {
      p.characters.forEach((char) => {
        const selectedInstance = instancePoints.find(i => i.instance === char.instance);

        if (selectedInstance && selectedInstance.points > 0) {
          playableInstances.push({
            instance: char.instance,
            level: char.level,
            players: [{ player: p.name, character: char.name, spec: char.spec }],
            points: selectedInstance.points,
            score: selectedInstance.points + (parseInt(char.level) * 5),
          });
        }
      });
    });

    // Sort playable instances
    playableInstances.sort(sortInstancesByScore);

    // Add forbidden instances
    uploadedData.forEach((p) => {
      p.characters.forEach((char) => {
        const selectedInstance = instancePoints.find(i => i.instance === char.instance);

        if (selectedInstance && selectedInstance.points <= 0) {
          forbiddenInstances.push({
            instance: char.instance,
            level: char.level,
            players: [{ player: p.name, character: char.name, spec: char.spec }],
            points: selectedInstance.points,
            score: selectedInstance.points + (parseInt(char.level) * 5),
          });
        }
      });
    });
    
    // Sort forbidden instances
    forbiddenInstances.sort(sortInstancesByScore);

    playableInstances.forEach(({ points, ...inst }) => { availableInstances.push(inst); });
    forbiddenInstances.forEach(({ points, ...inst }) => { availableInstances.push(inst); });

    log('getAvailableInstances > availableInstances', availableInstances);
    getGroupMembers();
  }

  // Get the rest of the team
  function getGroupMembers() {
    characterAssociations = [];

    uploadedData.forEach((p) => {
      p.characters.forEach((c) => {
        const position = characterAssociations.findIndex(char => char.character === c.character);

        log(c, position);
        // If this character is not registered, register it
        if (position < 0) {
          characterAssociations.push({
            player: p.name,
            character: c.name,
            spec: c.spec,
            instances: c.instance !== ''
              ? [{
                instance: c.instance,
                level: c.level,
              }]
              : [],
          });

        // If character is registered, update its instances record
        } else if (c.instance !== '') {
          characterAssociations[position].instances.push({
            instance: c.instance,
            level: c.lvl,
          });
        }
        
        log(characterAssociations);
      });
    });

    log('getGroupMembers > characterAssociations', characterAssociations);
    getTanks();
  }

  // Get a tank for each instance
  function getTanks() {
    tankCount += 1;
    getMember('tank');

    log('getTanks > availableInstances', availableInstances);
    log('getTanks > characterAssociations', characterAssociations);
    
    if (tankCount < maxTankCount) {
      getTanks()
    } else {
      getHealers();
    }
  }
  
  // Get a healer for each instance
  function getHealers() {
    healCount += 1;
    getMember('heal');

    log('getHealers > availableInstances', availableInstances);
    log('getHealers > characterAssociations', characterAssociations);
    
    if (healCount < maxHealCount) {
      getHealers()
    } else {
      getDPS();
    }
  }
  
  // Get a healer for each instance
  function getDPS() {
    DPSCount += 1;
    getMember('dps');

    log(`getDPS (${DPSCount}) > availableInstances`, availableInstances);
    log(`getDPS (${DPSCount}) > characterAssociations`, characterAssociations);

    // Get 3 DPS
    if (DPSCount < maxDPSCount) {
      getDPS();
    } else {
      displayTable();
    }
  }

  function getMember(spec) {
    // Go through each instance
    availableInstances.forEach((i) => {
      // Count for the players on that instance
      const memberCount = i.players.filter(p => p.spec.toLowerCase() === spec).length;

      // If there is 1 member with selected spec (3 if spec is DPS)
      if (memberCount < 1 || (spec === 'dps' && memberCount < 3)) {

        // Get all members with that spec, and sort them by availability (less instances associated)
        const membersWithSelectedSpec = characterAssociations.filter(c => c.spec.toLowerCase() === spec).sort(sortCharactersByAvailability);
        const filteredMembers = [];

        // Only add those characters whose players are not in the instance yet
        membersWithSelectedSpec.forEach((m) => {
          var isThisPlayerInThisGroup = false;
          i.players.forEach((p) => {
            if (p.player === m.player) {
              isThisPlayerInThisGroup = true;
            }
          });

          if (!isThisPlayerInThisGroup) {
            filteredMembers.push(m);
          }
        });


        // If there are members that fit with requirements
        if (filteredMembers.length) {
          
          // Select the first one
          const selectedMember = filteredMembers[0];

          // Add the instance to its record
          characterAssociations.find(c => c.character === selectedMember.character)
            .instances.push({
              instance: i.instance,
              level: i.level,
            });

          // Add the character to the instance record
          i.players.push({
            player: selectedMember.player,
            character: selectedMember.character,
            spec: selectedMember.spec,
          });
        
        // There are no members that fit with requirements
        }
      }
    });
  }

  // Draw a table with all the data
  function displayTable() {
    const tableId = 'mrc-groups';

    // Build table header
    const thead = `
    <thead>
      <tr>
        <th>Instance</th>
        <th>Owner</th>
        <th>Tank</th>
        <th>Healer</th>
        <th>DPS</th>
        <th>DPS</th>
        <th>DPS</th>
      </tr>
    </thead>
    `;

    // Build table body
    var tbody = '<tbody>';
    availableInstances.forEach((i) => {
      tbody += `
      <tr>
        <td>${i.instance} +${i.level}</td>
        <td>${i.players[0].player}</td>
        <td>
          ${i.players.find(p => p.spec.toLowerCase() === 'tank')
            ? i.players.find(p => p.spec.toLowerCase() === 'tank').character
            : ''
          }
        </td>
        <td>
          ${i.players.find(p => p.spec.toLowerCase() === 'heal')
            ? i.players.find(p => p.spec.toLowerCase() === 'heal').character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.spec.toLowerCase() === 'dps')[0]
            ? i.players.filter(p => p.spec.toLowerCase() === 'dps')[0].character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.spec.toLowerCase() === 'dps')[1]
            ? i.players.filter(p => p.spec.toLowerCase() === 'dps')[1].character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.spec.toLowerCase() === 'dps')[2]
            ? i.players.filter(p => p.spec.toLowerCase() === 'dps')[2].character
            : ''
          }
        </td>
      </tr>
      `;
    });
    tbody += '</tbody>';

    var table = document.querySelector(`#${tableId}`);
    log('Table exists?: ', table);

    if (!table) {
      table = document.createElement('table');
      table.id = tableId;
      table.classList.add('mc-table');
      table.classList.add('mc-horizontal');
      table.style = 'display: table;'
      
      mountPoint.appendChild(table);
    }

    table.innerHTML = `${thead}${tbody}`;
  }

  setUI();
})();
