import xml.etree.ElementTree as ET


def summarize_android_xml(xml_str):
    root = ET.fromstring(xml_str)
    summary = []
    for elem in root.iter():
        attrs = {}
        for key in ["resource-id", "class", "text", "content-desc", "hint", "bounds"]:
            if key in elem.attrib and elem.attrib[key]:
                attrs[key] = elem.attrib[key]
        if attrs:
            summary.append(attrs)
    return summary
