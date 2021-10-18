pragma solidity ^0.8.0;

import {IPausable} from "./IPausable.sol";
import {ERC20Extension} from "../ERC20Extension.sol";
import {IERC20Extension, TransferData} from "../../IERC20Extension.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {PausableLib} from "./PausableLib.sol";

contract PauseExtension is ERC20Extension, IPausable {

    constructor() {
        _registerFunction(PauseExtension.addPauser.selector);
        _registerFunction(PauseExtension.removePauser.selector);
        _registerFunction(PauseExtension.renouncePauser.selector);
        _registerFunction(PauseExtension.pause.selector);
        _registerFunction(PauseExtension.unpause.selector);
        _registerFunctionName('isPaused()');
        _supportInterface(type(IPausable).interfaceId);
    }

    modifier onlyPauser() {
        require(PausableLib.isPauser(msg.sender), "Only pausers can use this function");
        _;
    }

    function isPaused() public override view returns (bool) {
        return PausableLib.isPaused();
    }

    function initalize() external override {
        PausableLib.addPauser(msg.sender);
    }

    function pause() external override onlyPauser whenNotPaused {
        PausableLib.pause();
        emit Paused(msg.sender);
    }

    function unpause() external override onlyPauser whenPaused {
        PausableLib.unpause();
        emit Unpaused(msg.sender);
    }

    function addPauser(address account) external override onlyPauser {
        _addPauser(account);
    }

    function removePauser(address account) external override onlyPauser {
        _removePauser(account);
    }

    function renouncePauser() external override {
        _removePauser(msg.sender);
    }

    function _addPauser(address account) internal {
        PausableLib.addPauser(account);
        emit PauserAdded(account);
    }

    function _removePauser(address account) internal {
        PausableLib.removePauser(account);
        emit PauserRemoved(account);
    }

    function validateTransfer(TransferData memory data) external override view returns (bool) {
        bool isPaused = PausableLib.isPaused();

        require(!isPaused, "Transfers are paused");

        return true;
    }

    function onTransferExecuted(TransferData memory data) external override returns (bool) {
        bool isPaused = PausableLib.isPaused();

        require(!isPaused, "Transfers are paused");

        return true;
    }
}