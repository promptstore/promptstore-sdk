# promptstore-sdk

## Installation - Library

    npm i --save promptstore-sdk

## Basic usage

    const { PromptStore, logger } = require('promptstore-sdk');

    const ps = new PromptStore({ logger });

    ps.execute({
      name: 'summarize',
      args: { content: `On two occasions, I have been asked [by members of Parliament], 'Pray, Mr. Babbage, if you put into the machine wrong figures, 
will the right answers come out?' I am not able to rightly apprehend the kind of confusion of ideas that could provoke such a question.` },
      contentOnly: true,
    })
    .then((content) => {
      console.log(content);
    })
    .catch((err) => {
      console.error(err.message);
    });

## Installation - Test environment

### Install Python environment

    python -m venv venv
    . venv/bin/activate
    pip install --upgrade pip
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

Use the TypeScript kernel.