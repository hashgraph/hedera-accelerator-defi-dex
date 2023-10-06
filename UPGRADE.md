# Upgrade Strategy 
## Note 
1. The idea was to use [OpenZeppelin Upgrades Plugins](https://docs.openzeppelin.com/upgrades) but [hether](https://www.npmjs.com/package/) does not support deployProxy/upgradeProxy functionalities. 
2. The alternative using json-rpc-rely with ethers.js was also tried but that too was not supported. json-rpc-relay needs to work on this to support contract deployment using deployProxy or upgradeProxy. 

## Proxy type - TransparentUpgradeableProxy
For now, we have decided to use transparent proxy because it has proven the test of time. It is relatively less complex.

1. Added `import "@openzeppelin/hardhat-upgrades"` to `hardhat.config.ts`
2. Run `npx hardhat compile`
3. Run `npx hardhat run deployment/deploy.ts`

## Guidelines to update Swap contract - 

1. Going to unstructured storage for proxy pattern -
      This is why this approach is called "unstructured storage"; neither of the contracts(proxy or storage) needs to care about the structure of the other.
      This helps to avoid Storage collision

2. Storage Collisions Between Implementation Versions
      It is up to the user to have new versions of a logic contract extend previous versions, or otherwise guarantee that the storage hierarchy is always appended to but not modified.

3. The Constructor Caveat
    This code is executed only once, when the contract instance is deployed. As a consequence of this, the code within a logic contract’s constructor will never be executed in the context of the proxy’s state
    regular 'initializer' function, and have this function be called whenever the proxy links to this logic contract.

4. Transparent Proxies and Function Clashes
    how to proceed if the logic contract also has a function named upgradeTo(address): upon a call to that function, did the caller intend to call the proxy or the logic contract?
    transparent proxy pattern solves this. A transparent proxy will decide which calls are delegated to the underlying logic contract based on the caller address (i.e., the msg.sender):

### Important points for developers 
1. To prevent a contract from being initialized multiple times, you need to add a check to ensure the initialize function is called only once:
2. Initializable base contract that has an initializer modifier that takes care of this:
3. When writing an initializer, you need to take special care to manually call the initializers of all parent contracts. Note that the initializer modifier can only be called once even when using inheritance, so parent contracts should use the onlyInitializing modifier:
4. Use @openzeppelin/contracts-upgradeable contracts to import not OpenZeppelin Contracts . Yes there two packages contracts-upgradeable Vs Contracts so always chose openzeppelin/contracts-upgradeable
5. __gap. This is empty reserved space in storage that is put in place in Upgradeable contracts. TBD
6. Avoiding Initial Values in Field Declarations. It is still ok to define constant state variables, because the compiler does not reserve a storage slot for these variables, and every occurrence is replaced by the respective constant expression.
7. Do not leave an implementation contract uninitialized. An uninitialized implementation contract can be taken over by an attacker, which may impact the proxy. To prevent the implementation contract from being used, you should invoke the _disableInitializers
8. Creating New Instances From Your Contract Code.  Always use dependency injection.
9. Potentially Unsafe Operations 
`selfdestruct`
`delegatecall`
Calling functions of logic contract directly will not harm because state's in the context of proxy is used not logic contracts own. But `selfdestruct` and `delegatecall` can destory your logic contract. So they should be used on exception with appropriate acccess control.



### Modifying existing Contract
  1. You cannot change the type or order of fields in future logic contract versions.
  2. If you want to add new variable it should be appended after last logical contract field.
  3. You cannot remove an existing variable.
  4. Keep in mind that if you rename a variable, then it will keep the same value as before after upgrading.
  5. And if you remove a variable from the end of the contract, note that the storage will not be cleared. A subsequent update that adds a new variable will cause that variable to read the leftover value from the deleted one.
  Note that you may also be inadvertently changing the storage variables of your contract by changing its parent contracts. 
  6. You also cannot add new variables to base contracts, if the child has any variables of its own
  A workaround for this is to declare unused variables on base contracts that you may want to extend in the future, as a means of "reserving" those slots. Note that this trick does not involve increased gas usage.
