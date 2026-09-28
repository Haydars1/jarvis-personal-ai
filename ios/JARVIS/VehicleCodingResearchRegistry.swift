import Foundation
import Combine

struct ResearchSourceRecord: Codable, Hashable, Identifiable {
    let id: String
    let kind: EvidenceSourceKind
    let title: String
    let url: String
    let license: String?
    let allowedForDataImport: Bool
    let note: String
}

enum VehicleCodingResearchRegistry {
    static let sources: [ResearchSourceRecord] = [
        .init(
            id: "github-delphi-obd",
            kind: .github,
            title: "Delphi-OBD public diagnostic catalogs",
            url: "https://github.com/erdesigns-eu/Delphi-OBD",
            license: "Repository LICENSE.md must be reviewed before copying catalog data",
            allowedForDataImport: false,
            note: "Useful as factual architecture/reference; do not bulk-copy catalog data without a compatible license."
        ),
        .init(
            id: "github-vagcan",
            kind: .github,
            title: "vagcan VAG diagnostic research",
            url: "https://github.com/pashokitsme/vagcan",
            license: nil,
            allowedForDataImport: false,
            note: "Good evidence model for ODIS/VCDS-derived read data; repository does not advertise a copy license in the inspected root."
        ),
        .init(
            id: "github-polo-cornering",
            kind: .github,
            title: "PoloCornering / Carista reverse engineering",
            url: "https://github.com/victorwitkamp/PoloCornering",
            license: nil,
            allowedForDataImport: false,
            note: "Contains useful log-validated PQ25 evidence; import only independently verified factual mappings."
        ),
        .init(
            id: "ross-tech-wiki",
            kind: .rossTech,
            title: "Ross-Tech Wiki",
            url: "https://wiki.ross-tech.com/",
            license: nil,
            allowedForDataImport: false,
            note: "Use as evidence/citation; store normalized factual procedure rather than copied page text."
        ),
        .init(
            id: "forscan-forum-asbuilt",
            kind: .forum,
            title: "FORScan As-Built configuration research",
            url: "https://forum.forscan.org/",
            license: nil,
            allowedForDataImport: false,
            note: "Ford/Mazda module configuration, As-Built block formats, spreadsheets and empirical warnings."
        ),
        .init(
            id: "mbworld-variant-coding",
            kind: .forum,
            title: "MBWorld Vediamo / DTS Monaco variant-coding discussions",
            url: "https://mbworld.org/forums/mercedes-tech-talk/",
            license: nil,
            allowedForDataImport: false,
            note: "Mercedes variant-coding evidence; exact ECU/CBF/SMR-D identity must be verified before writes."
        ),
        .init(
            id: "clublexus-techstream",
            kind: .forum,
            title: "ClubLexus Techstream customization discussions",
            url: "https://www.clublexus.com/forums/",
            license: nil,
            allowedForDataImport: false,
            note: "Toyota/Lexus customization discovery; exact Customize Parameters must be tied to model/year/ECU."
        ),
        .init(
            id: "reddit-bmw-bimmercode",
            kind: .reddit,
            title: "BMW/MINI BimmerCode community reports",
            url: "https://www.reddit.com/r/BMW/",
            license: nil,
            allowedForDataImport: false,
            note: "Useful for feature discovery only; exact CAFD/FDL mapping requires stronger corroboration."
        )
    ]
}

@MainActor
final class CodingResearchStatus: ObservableObject {
    @Published private(set) var catalogCount = EvidenceBackedFeatureCatalog.all.count
    @Published private(set) var sourceCount = VehicleCodingResearchRegistry.sources.count

    func refresh() {
        catalogCount = EvidenceBackedFeatureCatalog.all.count
        sourceCount = VehicleCodingResearchRegistry.sources.count
    }
}
