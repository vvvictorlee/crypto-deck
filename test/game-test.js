'use strict';

const tape = require('tape');
const debug = require('debug')('test');

const elliptic = require('elliptic');

const poker = require('../');
const Game = poker.Game;

const CARD_COUNT = 52;
const CURVE = elliptic.curves.secp256k1.curve;
const PLAYER_COUNT = 4;

tape('Game: draw all', (t) => {
  const players = [];
  const logs = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const log = [];

    players.push(new Game({
      cardCount: CARD_COUNT,
      curve: CURVE,
      controller: {
        validateDraw: (p, i) => { log.push([ 'validateDraw', p ]); },
        draw: (p, i, v) => { log.push([ 'draw', p, i, v ]); },
        validateOpen: (p, i) => { log.push([ 'validateOpen', p, i ]); },
        open: (p, i, v) => { log.push([ 'open', p, i, v ]); }
      },
      index: i,
      playerCount: PLAYER_COUNT
    }));
    logs.push(log);
  }

  function send(msg, target, from) {
    process.nextTick(() => {
      if (target !== undefined) {
        debug(`P${from} sent: ${msg.type} to: P${target}`);
        return players[target].receive(msg, from);
      }

      debug(`P${from} broadcasted: ${msg.type}`);
      players.forEach((p, i) => {
        if (i !== from)
          p.receive(msg, from);
      });
    });
  }

  players.forEach((player, current) => {
    player.on('stateChange', (from, to) => {
      debug(`P${current} changed state from: ${from} to: ${to}`);
    });

    player.on('message', (msg, target) => {
      send(msg, target, current);
    });
  });

  players.forEach(player => player.start());

  const cards = [];
  function drawOne(index, done) {
    players[index].draw((err, card) => {
      if (err)
        return done(err);

      t.ok(0 <= card.value < CARD_COUNT,
           `.draw() should get valid card #${cards.length}`);
      cards.push(card);
      if (cards.length === CARD_COUNT)
        return done(null, cards);

      drawOne((index + 1) % PLAYER_COUNT, done);
    });
  }

  const opened = [];
  function openOne(index, done) {
    players[index % PLAYER_COUNT].open(index, (err, card) => {
      if (err)
        return done(err);

      opened.push(card);
      if (opened.length === CARD_COUNT)
        return done(null, opened);

      openOne(index + 1, done);
    });
  }

  function onReady() {
    drawOne(0, (err, cards) => {
      t.error(err, 'no error when drawing');
      t.equals(cards.length, CARD_COUNT, 'got right number of cards');
      openOne(0, (err, opened) => {
        t.error(err, 'no error when drawing');
        t.deepEquals(opened, cards, 'got right cards');
        t.end();
      });
    });
  }
  players[0].once('idle', onReady);
});
