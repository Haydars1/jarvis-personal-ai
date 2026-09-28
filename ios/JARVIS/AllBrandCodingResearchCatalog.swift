import Foundation

struct CodingResearchTarget: Identifiable, Hashable {
    let id: String
    let brands: [VehicleBrand]
    let ecosystems: [String]
    let githubQueries: [String]
    let webQueries: [String]
    let priority: Int
}

enum AllBrandCodingResearchCatalog {
    static let targets: [CodingResearchTarget] = [
        target(
            "vag",
            [.volkswagen, .audi, .seat, .skoda, .porsche],
            ["VCDS", "ODIS", "OBDeleven", "Carista"],
            [
                "VCDS adaptation long coding MQB MLB hidden features",
                "ODIS coding adaptation dataset VAG",
                "OBDeleven coding one click apps channels"
            ],
            [
                "VAG MQB MQB Evo MLB coding adaptation hidden features",
                "Volkswagen Audi Skoda Seat VCDS coding channels forum"
            ],
            100
        ),
        target(
            "bmw-mini",
            [.bmw, .mini],
            ["E-Sys", "BimmerCode", "Tool32", "ISTA", "NCS Expert"],
            [
                "BMW CAFD FDL coding values E-Sys",
                "BMW BimmerCode expert mode parameters",
                "BMW NCS Expert coding daten"
            ],
            [
                "BMW F G series FDL coding cheat sheet",
                "MINI BimmerCode hidden features forum"
            ],
            100
        ),
        target(
            "mercedes",
            [.mercedes],
            ["Vediamo", "DTS Monaco", "Xentry", "DAS"],
            [
                "Mercedes Vediamo variant coding CBF",
                "DTS Monaco SMR-D coding variant",
                "Mercedes ECU variant coding dataset"
            ],
            [
                "Mercedes Vediamo DTS Monaco variant coding hidden features",
                "Mercedes Xentry coding forum variant coding"
            ],
            100
        ),
        target(
            "ford-mazda",
            [.ford, .mazda],
            ["FORScan", "As-Built"],
            [
                "FORScan as built spreadsheet",
                "Ford As-Built module coding",
                "Mazda FORScan as built coding"
            ],
            [
                "Ford FORScan As-Built coding spreadsheet hidden features",
                "Mazda FORScan hidden features coding"
            ],
            95
        ),
        target(
            "toyota-lexus",
            [.toyota, .lexus],
            ["Techstream", "Customize Parameters"],
            [
                "Toyota Techstream customize parameters",
                "Lexus Techstream customization",
                "Toyota body ECU customization"
            ],
            [
                "Toyota Techstream customization hidden features",
                "Lexus dealer customization Techstream settings"
            ],
            95
        ),
        target(
            "hyundai-kia",
            [.hyundai, .kia],
            ["GDS", "KDS"],
            [
                "Hyundai GDS variant coding",
                "Kia KDS coding hidden features",
                "Hyundai body control coding"
            ],
            [
                "Hyundai GDS coding hidden features forum",
                "Kia KDS coding hidden features"
            ],
            90
        ),
        target(
            "renault-dacia",
            [.renault],
            ["DDT4All", "Renolink", "CLIP"],
            [
                "DDT4All Renault coding",
                "Renault DDT database ECU configuration",
                "Renolink coding"
            ],
            [
                "Renault DDT4All hidden features coding",
                "Dacia DDT4All coding hidden features"
            ],
            95
        ),
        target(
            "psa-stellantis",
            [.peugeot, .citroen, .opel, .fiat, .alfaRomeo, .jeep],
            ["Diagbox", "Lexia", "PP2000", "MultiECUScan", "AlfaOBD", "OP-COM"],
            [
                "Diagbox telecoding Peugeot Citroen",
                "MultiECUScan proxy alignment coding",
                "AlfaOBD body computer configuration",
                "OP-COM variant coding Opel"
            ],
            [
                "Peugeot Citroen Diagbox telecoding hidden features",
                "Fiat Alfa MultiECUScan coding hidden features",
                "Jeep AlfaOBD hidden features coding",
                "Opel OP-COM hidden features coding"
            ],
            95
        ),
        target(
            "volvo",
            [.volvo],
            ["VIDA", "VDASH", "OrBit"],
            [
                "Volvo VIDA configuration coding",
                "Volvo VDASH hidden features",
                "Volvo CEM configuration"
            ],
            [
                "Volvo VIDA hidden features coding",
                "Volvo VDASH coding forum"
            ],
            85
        ),
        target(
            "honda",
            [.honda],
            ["HDS", "i-HDS"],
            [
                "Honda HDS customization settings",
                "Honda body electrical customization HDS"
            ],
            [
                "Honda HDS hidden features customization",
                "Honda i-HDS customization forum"
            ],
            80
        ),
        target(
            "nissan",
            [.nissan],
            ["CONSULT", "CONSULT III+"],
            [
                "Nissan Consult configuration coding",
                "Nissan BCM configuration Consult",
                "Nissan hidden settings Consult III"
            ],
            [
                "Nissan CONSULT coding hidden features",
                "Nissan BCM configuration forum Consult"
            ],
            80
        ),
        target(
            "mitsubishi",
            [.mitsubishi],
            ["MUT-III", "ETACS Decoder"],
            [
                "Mitsubishi ETACS coding hidden features",
                "MUT III customization"
            ],
            [
                "Mitsubishi ETACS hidden features coding",
                "MUT III customization forum"
            ],
            80
        ),
        target(
            "jaguar-landrover",
            [.jaguar, .landRover],
            ["SDD", "Pathfinder", "JLR DoIP"],
            [
                "JLR SDD CCF coding",
                "Jaguar Land Rover Car Configuration File",
                "Pathfinder CCF coding"
            ],
            [
                "Jaguar Land Rover CCF hidden features coding",
                "JLR SDD coding forum"
            ],
            85
        ),
        target(
            "chevrolet-gm",
            [.chevrolet],
            ["GDS2", "Tech2", "SPS"],
            [
                "GM GDS2 configuration coding",
                "Tech2 body control customization"
            ],
            [
                "GM GDS2 hidden features coding",
                "Chevrolet Tech2 BCM programming options"
            ],
            80
        )
    ].sorted { lhs, rhs in
        lhs.priority == rhs.priority ? lhs.id < rhs.id : lhs.priority > rhs.priority
    }

    static var allBrands: Set<VehicleBrand> {
        Set(targets.flatMap(\.brands))
    }

    static var totalQueryCount: Int {
        targets.reduce(0) { $0 + $1.githubQueries.count + $1.webQueries.count }
    }

    private static func target(
        _ id: String,
        _ brands: [VehicleBrand],
        _ ecosystems: [String],
        _ githubQueries: [String],
        _ webQueries: [String],
        _ priority: Int
    ) -> CodingResearchTarget {
        .init(
            id: id,
            brands: brands,
            ecosystems: ecosystems,
            githubQueries: githubQueries,
            webQueries: webQueries,
            priority: priority
        )
    }
}
