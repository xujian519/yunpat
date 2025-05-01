fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().build_server(true).compile(
        &[
            "../../../protos/tools.proto",
            "../../../protos/common.proto",
        ],
        &["../../../protos"],
    )?;
    Ok(())
}
