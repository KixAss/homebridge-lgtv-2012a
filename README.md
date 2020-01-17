# homebridge-lgtv-2012a

`homebridge-lgtv-2012a` is a Homebridge plugin allowing you to control your LG TV (2012) with the Apple Home app & Control Centre remote!

The LG TV will display as a TV Accessory with Power, Input & Remote Control.

## Requirements
* iOS 12.2 (or later)
* [Homebridge](https://homebridge.io/) v0.4.46 (or later)

## Installation
Install homebridge-lgtv-2012a:
```sh
npm install -g homebridge-lgtv-2012a
```

## Usage Notes
Quickly switch input using the information (i) button in the Control Centre remote

## Configuration
Add a new platform to your homebridge `config.json`.

Example configuration:

```js
{
    "platforms": [
      {
        "platform": "lgtv-2012a",
        "name": "LG TV",
        "ip": "10.0.1.4",
        "pairingKey": "123456", 
        "min_volume": 2, "max_volume": 20,
        "on_command": "MUTE"
      }
    ]
  }
```

## Thanks to
[homebridge-lgtv-2012](https://github.com/i0null/homebridge-lgtv-2012)

[homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)