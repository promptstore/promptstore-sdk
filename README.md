# promptstore-sdk

## Installation

### Install Python environment

    python -m venv venv
    ./venv/bin/activate
    pip install -r requirements.txt

### Install Node environment

On OS X, ensure that libsodium is installed:

    brew install libsodium

Then install node packages:

    npm i

Make sure tslab command is available in your terminal.

    npm install -g tslab
    tslab install --version

Register tslab to your Jupyter environment.

    tslab install

By default, tslab is registered with python3 in unix-like system and python 
in Windows. If Jupyter is installed with a different Python in your system, 
please specify the python command with `--python` flag, e.g.

    tslab install --python=python3

Check two kernels (jslab and tslab) are installed properly to jupyter.

    jupyter kernelspec list

### Start Jupyter

    jupyter lab

Use the Typescript kernel.