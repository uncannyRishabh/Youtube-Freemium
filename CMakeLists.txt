cmake_minimum_required(VERSION 3.10)
project(Freemium)

set(EXTENSION_SRC "src")
set(OUTPUT_DIR "out/Chrome_Edge")
set(RELEASE_DIR "out/release")
set(DEFAULT_VERSION "LATEST")

option(VERSION "Chrome extension version" "${DEFAULT_VERSION}")
option(OBFUSCATE "Obfuscate code in release build" OFF)

# Construct the output filename
string(REPLACE "." "_" EXTENSION_VERSION_UNDERSCORE "${VERSION}")
set(OUTPUT_ZIP "youtube_freemium_${EXTENSION_VERSION_UNDERSCORE}.zip")
set(FULL_OUTPUT_PATH "${CMAKE_SOURCE_DIR}/${OUTPUT_DIR}/${OUTPUT_ZIP}")

set(RELEASE_ZIP "youtube_freemium_${EXTENSION_VERSION_UNDERSCORE}_release.zip")
set(FULL_RELEASE_ZIP_PATH "${CMAKE_SOURCE_DIR}/${OUTPUT_DIR}/${RELEASE_ZIP}")

# Ensure the output directory exists
file(MAKE_DIRECTORY "${CMAKE_SOURCE_DIR}/${OUTPUT_DIR}")

# Default development target: packs src directly
add_custom_target(
    extension
    COMMAND ${CMAKE_COMMAND} -E tar cf "${FULL_OUTPUT_PATH}" --format=zip .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/src
    COMMENT "Packing Chrome extension to ${FULL_OUTPUT_PATH}..."
)

# Custom command to print the completion message
add_custom_command(
    OUTPUT printed_done_message # Dummy output to track completion
    COMMAND ${CMAKE_COMMAND} -E echo "DONE ${FULL_OUTPUT_PATH}"
    DEPENDS extension
    VERBATIM
)

# Target that depends on the printing command
add_custom_target(
    package_and_print
    DEPENDS printed_done_message
    COMMENT "Packing and printing completion message"
)

# Target: Release build (strips comments, logs, minifies CSS/JSON)
add_custom_target(
    release
    COMMAND node "${CMAKE_SOURCE_DIR}/scripts/build-release.js" --src "${CMAKE_SOURCE_DIR}/src" --out "${CMAKE_SOURCE_DIR}/${RELEASE_DIR}"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Generating clean release build in ${RELEASE_DIR}..."
)

# Target: Release build with obfuscation/minification enabled
add_custom_target(
    release_obfuscate
    COMMAND node "${CMAKE_SOURCE_DIR}/scripts/build-release.js" --src "${CMAKE_SOURCE_DIR}/src" --out "${CMAKE_SOURCE_DIR}/${RELEASE_DIR}" --obfuscate
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Generating obfuscated release build in ${RELEASE_DIR}..."
)

# Target: Package release build into zip
add_custom_target(
    package_release
    DEPENDS release
    COMMAND ${CMAKE_COMMAND} -E tar cf "${FULL_RELEASE_ZIP_PATH}" --format=zip .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/${RELEASE_DIR}
    COMMAND ${CMAKE_COMMAND} -E echo "DONE RELEASE ZIP: ${FULL_RELEASE_ZIP_PATH}"
    COMMENT "Packaging release build to ${FULL_RELEASE_ZIP_PATH}..."
)

# Target: Package obfuscated release build into zip
add_custom_target(
    package_release_obfuscate
    DEPENDS release_obfuscate
    COMMAND ${CMAKE_COMMAND} -E tar cf "${FULL_RELEASE_ZIP_PATH}" --format=zip .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/${RELEASE_DIR}
    COMMAND ${CMAKE_COMMAND} -E echo "DONE RELEASE (OBFUSCATED) ZIP: ${FULL_RELEASE_ZIP_PATH}"
    COMMENT "Packaging obfuscated release build to ${FULL_RELEASE_ZIP_PATH}..."
)
