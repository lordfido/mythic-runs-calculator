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

  var uploadedData;
  const availableInstances = [];
  const characterAssociations = [];
  
  // Set initial UI
  function setUI() {
    var filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.id = 'file-picker';
    filePicker.name = 'file-picker';
    filePicker.addEventListener('change', handleFileChange);

    var wrapper = document.createElement('div');
    wrapper.classList.add('Wrapper');
    wrapper.id = 'mythic-calculator';
    wrapper.name = 'mythic-calculator';

    document.body.innerHTML = '';
    wrapper.appendChild(filePicker)
    document.body.appendChild(wrapper);
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

    // Add playable instances
    uploadedData.forEach((player) => {
      player.characters.forEach((char) => {
        const selectedInstance = instancePoints.find(i => i.instance === char.instance);

        if (selectedInstance && selectedInstance.points > 0) {
          playableInstances.push({
            instance: char.instance,
            level: char.level,
            players: [{ player: player.name, character: char.name, spec: char.spec }],
            points: selectedInstance.points,
            score: selectedInstance.points + (parseInt(char.level) * 5),
          });
        }
      });
    });

    // Sort playable instances
    playableInstances.sort(sortInstancesByScore);

    // Add forbidden instances
    uploadedData.forEach((player) => {
      player.characters.forEach((char) => {
        const selectedInstance = instancePoints.find(i => i.instance === char.instance);

        if (selectedInstance && selectedInstance.points <= 0) {
          forbiddenInstances.push({
            instance: char.instance,
            level: char.level,
            players: [{ player: player.name, character: char.name, spec: char.spec }],
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
    availableInstances.forEach((i) => {
      const position = characterAssociations.findIndex(c => c.character === i.players[0].character);

      // If this character is not registered, register it
      if (position < 0) {
        characterAssociations.push({
          player: i.players[0].player,
          character: i.players[0].character,
          spec: i.players[0].spec,
          instances: [{
            instance: i.instance,
            level: i.level,
          }],
        });

      // If character is registered, update its instances record
      } else {
        characterAssociations[position].instances.push({
          instance: i.instance,
          level: i.lvl,
        });
      }
    });

    log('getGroupMembers > characterAssociations', characterAssociations);
    getTanks();
  }

  // Get a tank for each instance
  function getTanks() {
    getMember('tank');

    log('getTanks > availableInstances', availableInstances);
    log('getTanks > characterAssociations', characterAssociations);
    getHealers();
  }
  
  // Get a healer for each instance
  function getHealers() {
    getMember('heal');

    log('getHealers > availableInstances', availableInstances);
    log('getHealers > characterAssociations', characterAssociations);
    getDPS();
  }
  
  // Get a healer for each instance
  var DPSCount = 0;
  function getDPS() {
    DPSCount += 1;
    getMember('dps');

    log(`getDPS (${DPSCount}) > availableInstances`, availableInstances);
    log(`getDPS (${DPSCount}) > characterAssociations`, characterAssociations);

    // Get 3 DPS
    if (DPSCount < 3) {
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

    const table = `<table>${thead}${tbody}</table>`;
    document.body.innerHTML += table;
  }

  setUI();
})();
