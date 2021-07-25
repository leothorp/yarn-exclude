#!/usr/bin/env bash
 
 upgrade_type=$1 #patch, minor, or major   
 npm version $upgrade_type && \
 npm publish && \
 git push origin HEAD && \
 git push --tags
