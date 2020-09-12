#!/usr/bin/env node
const Steam = require('steam')
const SteamUser = require('steam-user')
const SteamTotp = require('steam-totp')
const colors = require('colors')
const fs = require('fs')
var figlet = require('figlet')
const readline = require('readline')

const blank = '\n'.repeat(process.stdout.rows)
console.log(blank)
readline.cursorTo(process.stdout, 0, 0)
readline.clearScreenDown(process.stdout)

figlet('Steam Idler', function(err, data) {
    if (err) {
        console.log('Wystapil blad...'.red);
        console.dir(err);
        return;
    }
    console.log(`${data}`.blue)
});

let config
if (fs.existsSync('./config.json')) {
  config = require('./config.json')
  if (!compareKeys(config, require('./config.example.json'))) {
    log('Config zostal zaktualizowany')
    process.exit(1)
  };
} else {
  log('Nie znaleziono configu. Utworz go na podstawie pliku config.example.json'.red)
  process.exit(0)
}

if (config.username === '' || config.password === '') {
  log('Brak nazwy uzytkownika lub hasla w pliku config.json!'.red)
  process.exit(1)
}

const responded = []

let playme = config.gamestoplay
log('Ladowanie...'.green)
const templay = parseInt(playme.length)
if (config.donotsort === false) {
  playme = uniq(playme)
};

log('Usunieto ' + parseInt(templay - playme.length) + ' powtorek z listy gier'.yellow)

if (playme.length > 33 && config.bypasslimit === false) {
  log('Mozna idlowac tylko 33 gry na raz ze wzgledu na ograniczenia nalozone przez steam. Usun kilka gier z configu i uruchom program ponownie!'.red)
  process.exit(1)
};

if (config.bypasslimit === true) {
  log('UWAGA: Ominciecie limitu idlowanych gier moze niesc ze soba rozne konsekwencje!'.red)
};

const client = new SteamUser({
  autoRelogin: true
})


function uniq (a) {
  return a.sort().filter(function (item, pos, ary) {
    return !pos || item !== ary[pos - 1]
  })
}

function log (message) {
  const date = new Date()
  const time = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
  for (let i = 1; i < 6; i++) {
    if (time[i] < 10) {
      time[i] = '0' + time[i]
    }
  }
  console.log(time[0] + '-' + time[1] + '-' + time[2] + ' ' + time[3] + ':' + time[4] + ':' + time[5] + ' - ' + message)
}

function compareKeys (a, b) {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  return JSON.stringify(aKeys) === JSON.stringify(bKeys)
}


function shutdown (code) {
  setTimeout(function () {
    process.exit(code)
  }, 500)
}


client.logOn({
  accountName: config.username,
  password: config.password,
  promptSteamGuardCode: false,
  twoFactorCode: SteamTotp.getAuthCode(config.twofactorcode),
  rememberPassword: true
})

client.on('loggedOn', function (details, parental) {
  client.webLogOn()
  client.getPersonas([client.steamID], function (err, steamid) {
    if (err) log('Blad: ' + err)
    log('Zalogowano jako '.green + steamid[client.steamID].player_name)
    client.requestFreeLicense(playme)
    log('Idlowanie: ' + playme.length + ' gier')
    client.gamesPlayed(playme)
    if (config.silent === false) {
      client.setPersona(Steam.EPersonaState.Online)
    };
  })
})

client.on('error', function (e) {
  log('Blad' + e)
  shutdown(1)
})

client.on('friendMessage', function (steamid, message) {
  if (config.sendautomessage === true && responded.indexOf(steamid.getSteamID64()) === -1) {
    if(message == 'Invited you to play a game!') return;
    client.getPersonas([steamid], function (err, steamids) {
      if (err) log('Error: ' + err)
      log('Nowa wiadomosc : ' + steamids[steamid].player_name + ' ID:[' + steamid.getSteamID64() + ']: ' + message)
      client.chatMessage(steamid, config.automessage)
      responded.push(steamid.getSteamID64())
    })
  };
})

client.on('lobbyInvite', function (inviterID, lobbyID) {
  if (config.sendautomessage === true && responded.indexOf(inviterID.getSteamID64()) === -1) {
    responded.push(inviterID.getSteamID64())
    client.chatMessage(inviterID, config.automessage)
  };
})

process.on('SIGINT', function () {
  log('Trwa wylogowanie...'.red)
  shutdown(0)
})
