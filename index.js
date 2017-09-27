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

  // Sort character list by availability (less instances assigned)
  function sortCharactersByAvailability(a,b) {
    if (a.instances.length < b.instances.length) return -1;    
    if (a.instances.length > b.instances.length) return 1;
    return 0;
  }

  // Remove spaces, tolowercase, to array
  function normalize(string) {
    return string.toLowerCase().replace(/\ /g, '').split(',');
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

    function parsedInstance(p, char, selectedInstance) {
      const charSpecs = normalize(char.specs);
      const selectedSpec = charSpecs.indexOf('tank') > -1
        ? 'tank'
        : charSpecs.indexOf('heal') > -1
          ? 'heal'
          : 'dps';

      return {
        instance: char.instance,
        level: char.level,
        players: [
          {
            player: p.name,
            character: char.name,
            specs: charSpecs,
            selectedSpec: selectedSpec,
          }
        ],
        points: selectedInstance.points,
        score: selectedInstance.points + (parseInt(char.level) * 5),
      };
    }

    // Add playable instances
    uploadedData.forEach((p) => {
      p.characters.forEach((char) => {
        const selectedInstance = instancePoints.find(i => i.instance === char.instance);

        if (selectedInstance && selectedInstance.points > 0) {
          playableInstances.push(parsedInstance(p, char, selectedInstance));
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
          forbiddenInstances.push(parsedInstance(p, char, selectedInstance));
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

        // If this character is not registered, register it
        if (position < 0) {
          characterAssociations.push({
            player: p.name,
            character: c.name,
            specs: normalize(c.specs),
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
      });
    });

    log('getGroupMembers > characterAssociations', characterAssociations);
    getEmptyRoles();
  }

  // Get empty roles
  function getEmptyRoles() {
    tankCount = 0;
    healCount = 0;
    DPSCount = 0;

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
  
  // Get a dps for each instance
  function getDPS() {
    DPSCount += 1;
    getMember('dps');

    log(`getDPS (${DPSCount}) > availableInstances`, availableInstances);
    log(`getDPS (${DPSCount}) > characterAssociations`, characterAssociations);

    // Get 3 DPS
    if (DPSCount < maxDPSCount) {
      getDPS();
    } else {
      verifyEmptyRoles();
    }
  }

  // Get a member of the specified spec
  function getMember(spec) {
    // Go through each instance
    availableInstances.forEach((i) => {
      // Count for the players on that instance
      const memberCount = i.players.filter(p => p.selectedSpec === spec).length;

      // If there is less than 1 member with selected spec (3 if spec is DPS)
      if (memberCount < 1 || (spec === 'dps' && memberCount < 3)) {

        // Get all members with that spec, and sort them by availability (less instances associated)
        const membersWithSelectedSpec = characterAssociations.filter(c => c.specs.indexOf(spec) > -1).sort(sortCharactersByAvailability);
        const filteredMembers = [];

        log(`Looking for a <${spec}> to do ${i.instance} +${i.level}, from ${i.players[0].character} (${i.players[0].player}). Available options are: `, membersWithSelectedSpec);

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
          log(`A ${spec} was found! The choosen one is ${selectedMember.character} (${selectedMember.player})`, selectedMember);

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
            specs: selectedMember.specs,
            selectedSpec: spec,
          });
        
        // There are no members that fit with requirements
        }
      }
    });
  }

  // Fix possible empty roles
  function verifyEmptyRoles() {
    availableInstances.forEach((i) => {
      const tanksCount = i.players.filter(c => c.selectedSpec === 'tank');
      const DPSsCount = i.players.filter(c => c.selectedSpec === 'dps');
      
      // If there is a tank available, it has been already set as tank,
      // so there is no sense looking for a tank in case tank is not assigned
      // because this means there is no tank available.
      
      // If there is no healer in the group
      const healsCount = i.players.filter(c => c.selectedSpec === 'heal');
      if (healsCount < maxHealCount) {
        const spec = 'heal';
        log(`${i.instance} +${i.level} has no <${spec}> associated!`);
    
        // Look for a player sith desired spec in the group
        const possibleOptions = [
          ...i.players.filter((c) => {
            return (
              // Character has a different selectedSpec
              c.selectedSpec !== spec
      
              // Character with desired spec
              && c.specs.indexOf(spec) > -1
      
              // Not the owner of the keystone
              && c.player !== i.players[0].player
            );
          }),
          ...characterAssociations.filter((c) => {
            return (
              // Character with desired spec
              c.specs.indexOf(spec) > -1
              
              // Not the owner of the keystone
              && c.player !== i.players[0].player
            );
          }),
        ].sort(sortCharactersByAvailability);
        
        // If there are possible options in the group
        if (possibleOptions.length) {
          log(`These members can perform as <${spec}>:`, possibleOptions);
    
          var selectedCharacter;
    
          // If there is only one option, take it
          if (possibleOptions.length === 1) {
            selectedCharacter = possibleOptions[0];
    
          // If there are several options, pick the first DPS that cannot perform as tank
          } else {
            selectedCharacter = possibleOptions.filter(c => c.specs.indexOf('tank') < 0)[0];
          }
    
          // If a valid character was selected
          if (selectedCharacter) {
            log(`${selectedCharacter.character} (${selectedCharacter.player}) the best option to <${spec}> the instance.`);

            // If selected player already assigned to the group
            const assignedCharacter = i.players.filter(c => c.player === selectedCharacter.player)
              && i.players.filter(c => c.player === selectedCharacter.player)[0];

            if (assignedCharacter) {

              // If assigned character is the same character than selected (switch spec)
              if (assignedCharacter.character === selectedCharacter.character) {
                log(`${assignedCharacter.character} (${assignedCharacter.player}) is already on the instance as <${assignedCharacter.selectedSpec}>`);

                // If selected character is the Tank of the group, look for a possible replacement
                if (assignedCharacter.selectedSpec === 'tank') {
                  log(`${assignedCharacter.character} is the <tank> of the group, looking for a replacement.`);
    
                  const otherTanksInTheGroup = i.players.filter(c => {
                    return (
                      // Not the current selected tank
                      c.selectedSpec !== 'tank'
              
                      // Character with tank spec
                      && c.specs.indexOf('tank') > -1
              
                      // Not the owner of the keystone
                      && c.character !== i.players[0].character
                    );
                  });
    
                  log('Other tanks in the group are: ', otherTanksInTheGroup);
    
                  // If available replacement on the group
                  if (otherTanksInTheGroup.length) {
                    log(`${otherTanksInTheGroup[0].character} has switched from <${otherTanksInTheGroup[0].selectedSpec}> to <tank>`);
                    i.players.find(c => c.character === otherTanksInTheGroup[0].character).selectedSpec = 'tank';
                    
                    log(`${selectedCharacter.character} has switched from <${selectedCharacter.selectedSpec}> to <${spec}>`);
                    i.players.find(c => c.character === selectedCharacter.character).selectedSpec = spec;
                  }
                
                // If selected character is not the tank of the group
                } else {
                  i.players.find(c => c.character === selectedCharacter.character).selectedSpec = spec;
                  log(`${selectedCharacter.character} has switched from <${selectedCharacter.selectedSpec}> to <${spec}>`);
                }

              // If assigned character is not the selected character (needs change character)
              } else {
                log(`${assignedCharacter.character} (${assignedCharacter.player}) needs to change its character, joining with ${selectedCharacter.character} as <${assignedCharacter.selectedSpec}>`);

                // Add character to the group
                const charPosition = i.players.findIndex(c => c.character === assignedCharacter.character);
                i.players[charPosition] = {
                  player: selectedCharacter.player,
                  character: selectedCharacter.character,
                  specs: selectedCharacter.specs,
                  selectedSpec: spec,
                };

                // Remove instance assignament to assignedCharacter
                const instPosition = characterAssociations.find(c => c.character === assignedCharacter.character).instances.findIndex(ins => ins.instance === i.instance && ins.level === i.level);
                characterAssociations.find(c => c.character === assignedCharacter.character).instances.splice(instPosition, 1);

                // Add instance assignament to selectedCharacter
                characterAssociations.find(c => c.character === selectedCharacter.character).instances.push({
                  instance: i.instance,
                  level: i.level,
                });
              }
            
            // Not part of the group
            } else {
              i.players.push({
                player: selectedCharacter.player,
                character: selectedCharacter.character,
                specs: selectedCharacter.specs,
                selectedSpec: spec,
              });
              log(`${selectedCharacter.character} has joined to the group as <${spec}>`);
            }
            
            // Complete the group
            getEmptyRoles();
          }
        }
      }
    });

    displayTable();
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
          ${i.players.find(p => p.selectedSpec === 'tank')
            ? i.players.find(p => p.selectedSpec === 'tank').character
            : ''
          }
        </td>
        <td>
          ${i.players.find(p => p.selectedSpec === 'heal')
            ? i.players.find(p => p.selectedSpec === 'heal').character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.selectedSpec === 'dps')[0]
            ? i.players.filter(p => p.selectedSpec === 'dps')[0].character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.selectedSpec === 'dps')[1]
            ? i.players.filter(p => p.selectedSpec === 'dps')[1].character
            : ''
          }
        </td>
        <td>
          ${i.players.filter(p => p.selectedSpec === 'dps')[2]
            ? i.players.filter(p => p.selectedSpec === 'dps')[2].character
            : ''
          }
        </td>
      </tr>
      `;
    });
    tbody += '</tbody>';

    var table = document.querySelector(`#${tableId}`);

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
