console.log('1: Starting imports');
import express from 'express';
console.log('2: Express imported');
import { getAgentEnsRoot } from './src/config/agents.js';
console.log('3: agents config imported');
import { getRelayXChain } from './src/config/chain.js';
console.log('4: chain config imported');

console.log('All imports successful!');
console.log('ENS root:', getAgentEnsRoot());
console.log('Chain:', getRelayXChain().name);
