from setuptools import setup, find_packages

setup(
    name="anp-sdk",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    package_data={"anp_sdk": ["contracts/abis/*.json"]},
)
