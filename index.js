var ping = require('ping');
var inherits = require('util').inherits;
var lgtv = require('lgtv-2012').lgtv;

let Service;
let Characteristic;

// --== MAIN SETUP ==--
function LGPlatform(log, config) {
  this.log = log;
  this.config = config;
}

/* Initialise Accessory */
function LGAccessory(log, config) {
  this.log = log;

  this.config = config;

	this.name = config.name || 'LGTV';
	this.key = config.pairingKey;
	this.host = config.ip;
	this.port = parseInt(config.port) || 8080;

	// set up tv object and debug flags
	this.tv = new lgtv({ 'host': this.host, 'port': this.port});
	this.tv.debug = (config.debug === true || config.debug == "true");
	this.tv.min_volume = config.min_volume || 2;
	this.max_volume = 100 / (parseInt(config.max_volume) || 20);
	this.on_command = String(config.on_command).toUpperCase() || 'MUTE';
	this.tv.false_run = config.false_run == "true";


  this.inputs = [];
  this.enabledServices = [];
  this.inputServices = [];
  this.powered = false;


  // Check & Update Accessory Status every 5 seconds
  this.checkStateInterval = setInterval(
    this.updateLgState.bind(this),
    5000
  );
}

module.exports = (homebridge) => {
  ({ Service, Characteristic } = homebridge.hap);
  homebridge.registerPlatform('homebridge-lgtv-2012a', 'lgtv-2012a', LGPlatform);
};

LGPlatform.prototype = {
  accessories(callback) {
    callback([
      new LGAccessory(
        this.log,
        this.config
      ),
    ]);
  },
};

LGAccessory.prototype = {
  /* Services */
  getServices() {
    this.informationService();
    this.televisionService();
    this.televisionSpeakerService();
    this.inputSourceServices();
	this.volumeService();

    return this.enabledServices;
  },

  informationService() {
    // Create Information Service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'LG TV 2012')
      // .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
      .setCharacteristic(Characteristic.Model, 'LG Electronics Inc.')
      .setCharacteristic(Characteristic.SerialNumber, 'Unknown');

    this.enabledServices.push(this.informationService);
  },

  televisionService() {
    // Create Television Service (AVR)
    this.tvService = new Service.Television(this.name, 'lgService');

    this.tvService
      .setCharacteristic(Characteristic.ConfiguredName, this.name)
      .setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    this.tvService.getCharacteristic(Characteristic.Active)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this));

    this.tvService.getCharacteristic(Characteristic.ActiveIdentifier)
        .on('get', this.getChannel.bind(this))
        .on('set', this.setChannel.bind(this));

    this.tvService.getCharacteristic(Characteristic.RemoteKey)
      .on('set', this.remoteKeyPress.bind(this));

    this.enabledServices.push(this.tvService);
  },

  televisionSpeakerService() {
      this.tvSpeakerService = new Service.TelevisionSpeaker(`${this.name} AVR`, 'lgSpeakerService');
      this.tvSpeakerService
        .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
        .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

      this.tvSpeakerService
        .getCharacteristic(Characteristic.VolumeSelector)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));

      this.tvService.addLinkedService(this.tvSpeakerService);
      this.enabledServices.push(this.tvSpeakerService);
  },


  inputSourceServices() {
    for (let i = 0; i < 50; i++) {
      const inputService = new Service.InputSource(i, `inputSource_${i}`);

      inputService
        .setCharacteristic(Characteristic.Identifier, i)
        .setCharacteristic(Characteristic.ConfiguredName, `Input ${i < 9 ? `0${i + 1}` : i + 1}`)
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION)
        .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);

      inputService
        .getCharacteristic(Characteristic.ConfiguredName)
        .on('set', (value, callback) => {
          callback(null, value);
        });

      this.tvService.addLinkedService(inputService);
      this.inputServices.push(inputService);
      this.enabledServices.push(inputService);
    }
  },

  volumeService() {
   this.volumeService = new Service.Lightbulb(this.name + ' Volume', 'volumeService');
   this.volumeService
       .getCharacteristic(Characteristic.On)
       .on('get', this.getMuteState.bind(this))
       .on('set', this.setMuteState.bind(this));
   this.volumeService
       .addCharacteristic(new Characteristic.Brightness())
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));

   this.enabledServices.push(this.volumeService);
  },



  /* State Handlers */
  updateLgState(error, status) {
    if (this.tvService) {

		if (!this.host || !this.host.length) 
		{
			this.powered = false
		}
		else 
		{
			ping.sys.probe(this.host, (isAlive) => {
				this.powered = isAlive;
				this.tvService.getCharacteristic(Characteristic.Active).updateValue(this.powered);

				if (this.powered)
				{
					this.connect((tv) => {
						tv.get_channels( (channels) => {
							this.log(channels);
						});


						tv.get_channel( (channel) => {
							console.log(channel);

							if (channel && channel.number)
							{
								//this.log(`On Channel: #${channel.number} ${channel.title}`);
								return this.tvService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(channel.number - 1);
							}

							/*
							  this.inputs.filter((input, index) => {
								if (input.id === channel.number) {
								  // Get and update homekit accessory with the current set input
								  if (this.tvService.getCharacteristic(Characteristic.ActiveIdentifier).value !== index) {
									this.log(`Updating input from ${input.name} to ${input.name}`);
								  }
								}

								return null;
							  });     
							  */
						});
					});
				}

			}, { timeout: 1, min_reply: 1 });
		}
    }
  },


	connect(cb) {
		if (this.host && this.host.length && this.port) 
		{
			this.tv.new_session(this.key, (tv) => {
				this.powered = Boolean(tv);
				cb(tv);
			});
		}
		else 
		{
			this.log('Does not appear to be powered on');
			this.powered = false;
			cb(null);
		}
	},

	getState(cb) {
		if (!this.host || !this.host.length) 
			cb(null, false)
		else 
		{
			ping.sys.probe(this.host, (isAlive) => {
				this.powered = isAlive;
				cb(null, isAlive);
			}, { timeout: 1, min_reply: 1 });
		}
	},

	setState(toggle, cb) {
		if(!this.powered || this.tv.locked) 
		{ 
			this.log('Unable to change power settings at this time')
			cb(null, false)
		} 
		else 
		{
			this.getState((error, alive) => { 
				this.connect((tv) => {
					this.log('Turning ' + toggle?'On':'Off')
					if(toggle) tv.send_command(this.on_command, (err) => { cb(null, true) });
					else tv.send_command('POWER', (err) => { cb(null, true) });
				}) 
			})
		}
	},

	getVolume(cb) {
		if(!this.powered || this.tv.locked) 
		{ 
			cb(null, 1)
		} 
		else 
		{
			this.connect((tv) => {
				tv.get_volume( (volume) => {
					this.log('Volume is ' +volume.level+ ' and Mute is ' + volume.mute?'On':'Off');
					cb(null, Math.round(volume.level * this.max_volume));
				})
			})
		}
	},

	setVolume(to, cb) {
		this.connect((tv) => {
			tv.set_volume(Math.round(to / this.max_volume), (err) => {
				this.log('Setting Volume to ' +to+ '... ' + err?'Success':'Failure');
				cb(null, true);
			})
		})
	},

	getMuteState(cb) {
		if(!this.powered || this.tv.locked) 
		{
			cb(null, false)
		} 
		else 
		{
			this.connect((tv) => {
				tv.get_volume( (volume) => {
					this.log('Mute is ' + (volume.mute?'On':'Off'));
					cb(null, !volume.mute);
				})
			})
		}
	},

	setMuteState(to, cb) {
		cb(null, false);
	},


	getChannel(cb) {
		if (!this.host || !this.host.length) cb(null, false)
		else {
			this.connect((tv) => {
				tv.get_channel( (channel) => {
//					this.log(`On Channel: #${channel.number} ${channel.title}`);
					cb(null, channel.number)
				})
			})
		}
	},

	setChannel(channel, cb) {
		this.connect((tv) => {
			channel = parseInt(channel);
			if(channel) tv.set_channel(channel, (err) => {
				if(!err) this.log(`Set channel to ${channel}`);
				cb(true, err);
			});
		})
	},

	getChannelName(cb) {
		this.connect((tv) => {
			tv.get_channel( (channel) => {
				this.log(`Channel: ${channel.title}`);
				cb(null, channel.title);
			})
		})
	},


  sendRemoteCode(remoteKey, callback) {
	  this.log('sendRemoteCode');

	callback(true);
  },

  remoteKeyPress(remoteKey, callback) {
    switch (remoteKey) {
      case Characteristic.RemoteKey.REWIND:
        this.sendKey('MediaRewind');
        callback();
        break;
      case Characteristic.RemoteKey.FAST_FORWARD:
        this.sendKey('MediaFastForward');
        callback();
        break;
      case Characteristic.RemoteKey.NEXT_TRACK:
        this.sendKey('DisplaySwap');
        callback();
        break;
      case Characteristic.RemoteKey.PREVIOUS_TRACK:
        this.sendKey('DisplaySwap');
        callback();
        break;
      case Characteristic.RemoteKey.ARROW_UP:
        this.sendKey('ArrowUp');
        callback();
        break;
      case Characteristic.RemoteKey.ARROW_DOWN:
        this.sendKey('ArrowDown');
        callback();
        break;
      case Characteristic.RemoteKey.ARROW_LEFT:
        this.sendKey('ArrowLeft');
        callback();
        break;
      case Characteristic.RemoteKey.ARROW_RIGHT:
        this.sendKey('ArrowRight');
        callback();
        break;
      case Characteristic.RemoteKey.SELECT:
        this.sendKey('Enter');
        callback();
        break;
      case Characteristic.RemoteKey.BACK:
        this.sendKey('Exit');
        callback();
        break;
      case Characteristic.RemoteKey.EXIT:
        this.sendKey('Exit');
        callback();
        break;
      case Characteristic.RemoteKey.PLAY_PAUSE:
        this.sendKey('MediaPlay');
        callback();
        break;
      case Characteristic.RemoteKey.INFORMATION:
        this.sendKey('Info');
        callback();
        break;
      default:
        callback();
        break;
    }
  },
};
